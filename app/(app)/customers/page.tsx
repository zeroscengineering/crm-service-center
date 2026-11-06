import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, formatDate, formatPhone, normalizePhone } from "@/lib/format";
import type { Customer } from "@/lib/types";

type Row = Customer & { tools: { count: number }[]; repair_jobs: { count: number }[] };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*, tools(count), repair_jobs(count)")
    .order("created_at", { ascending: false })
    .limit(100);

  const term = cleanSearch(q);
  if (term) {
    const digits = normalizePhone(term);
    const filters = [`name.ilike.%${term}%`, `line_id.ilike.%${term}%`];
    if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);
    query = query.or(filters.join(","));
  }

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ลูกค้า & เครื่องมือ</h1>
        <p className="text-sm text-zinc-500">ลูกค้าใหม่จะถูกสร้างอัตโนมัติจากฟอร์มรับแจ้งซ่อม</p>
      </header>

      <form>
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อ / เบอร์โทร / LINE ID"
          className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">ชื่อ</th>
              <th className="px-4 py-2 font-medium">เบอร์โทร</th>
              <th className="px-4 py-2 font-medium">LINE ID</th>
              <th className="px-4 py-2 text-center font-medium">เครื่อง</th>
              <th className="px-4 py-2 text-center font-medium">งานซ่อม</th>
              <th className="px-4 py-2 font-medium">ลงทะเบียน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50">
                <td className="px-4 py-2">
                  <Link href={`/customers/${c.id}`} className="font-medium text-brand hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{formatPhone(c.phone)}</td>
                <td className="px-4 py-2">{c.line_id ?? "-"}</td>
                <td className="px-4 py-2 text-center">{c.tools[0]?.count ?? 0}</td>
                <td className="px-4 py-2 text-center">{c.repair_jobs[0]?.count ?? 0}</td>
                <td className="px-4 py-2">{formatDate(c.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  ไม่พบลูกค้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
