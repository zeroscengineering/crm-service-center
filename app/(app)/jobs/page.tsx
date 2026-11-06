import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { STATUSES, STATUS_LABEL, type RepairStatus } from "@/lib/constants";
import { cleanSearch, formatDate, formatPhone } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

type Row = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  received_at: string;
  technician_name: string | null;
  customers: { name: string; phone: string } | null;
  tools: { brand: string; model: string; serial_number: string | null } | null;
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const profile = await requireProfile();
  const { q = "", status = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("repair_jobs")
    .select(
      "id, doc_no, status, received_at, technician_name, customers(name, phone), tools(brand, model, serial_number)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  const term = cleanSearch(q);
  if (term) query = query.ilike("doc_no", `%${term}%`);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">งานซ่อม</h1>
          <p className="text-sm text-zinc-500">มุมมอง Pipeline (Kanban) จะมาในเฟส 3</p>
        </div>
        {profile.role === "admin" && (
          <Link
            href="/jobs/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            + รับแจ้งซ่อมใหม่
          </Link>
        )}
      </header>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาเลขที่เอกสาร"
          className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-100">ค้นหา</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">เลขที่เอกสาร</th>
              <th className="px-4 py-2 font-medium">วันที่รับ</th>
              <th className="px-4 py-2 font-medium">ลูกค้า</th>
              <th className="px-4 py-2 font-medium">เครื่องมือ</th>
              <th className="px-4 py-2 font-medium">ช่าง</th>
              <th className="px-4 py-2 font-medium">สถานะ</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((j) => (
              <tr key={j.id}>
                <td className="px-4 py-2 font-mono">{j.doc_no}</td>
                <td className="px-4 py-2">{formatDate(j.received_at)}</td>
                <td className="px-4 py-2">
                  {j.customers?.name}
                  <span className="block text-xs text-zinc-500">{formatPhone(j.customers?.phone)}</span>
                </td>
                <td className="px-4 py-2">
                  {j.tools?.brand} {j.tools?.model}
                  {j.tools?.serial_number && (
                    <span className="block font-mono text-xs text-zinc-500">S/N {j.tools.serial_number}</span>
                  )}
                </td>
                <td className="px-4 py-2">{j.technician_name ?? "-"}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={j.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/print/job/${j.id}`} className="text-brand hover:underline">
                    ใบรับเครื่อง
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  ไม่พบงานซ่อม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
