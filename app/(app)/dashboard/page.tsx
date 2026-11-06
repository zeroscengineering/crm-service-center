import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PIPELINE, STATUS_LABEL, type RepairStatus } from "@/lib/constants";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

type JobRow = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  received_at: string;
  customers: { name: string } | null;
  tools: { brand: string; model: string } | null;
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: statusRows }, recentRes] = await Promise.all([
    supabase.from("repair_jobs").select("status"),
    supabase
      .from("repair_jobs")
      .select("id, doc_no, status, received_at, customers(name), tools(brand, model)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const recent = (recentRes.data ?? []) as unknown as JobRow[];

  const counts = Object.fromEntries(PIPELINE.map((s) => [s, 0])) as Record<RepairStatus, number>;
  for (const row of statusRows ?? []) {
    const s = row.status as RepairStatus;
    if (s in counts) counts[s] += 1;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <p className="text-sm text-zinc-500">สวัสดี {profile.full_name}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PIPELINE.map((s) => (
          <div key={s} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{STATUS_LABEL[s]}</p>
            <p className="mt-1 text-3xl font-bold">{counts[s]}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">งานซ่อมล่าสุด</h2>
        {recent && recent.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">เลขที่เอกสาร</th>
                  <th className="px-4 py-2 font-medium">ลูกค้า</th>
                  <th className="px-4 py-2 font-medium">เครื่องมือ</th>
                  <th className="px-4 py-2 font-medium">วันที่รับ</th>
                  <th className="px-4 py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recent.map((j) => (
                  <tr key={j.id}>
                    <td className="px-4 py-2 font-mono">
                      <Link href={`/jobs/${j.id}`} className="font-semibold text-brand hover:underline">
                        {j.doc_no}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{j.customers?.name}</td>
                    <td className="px-4 py-2">
                      {j.tools?.brand} {j.tools?.model}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(j.received_at).toLocaleDateString("th-TH")}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={j.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            ยังไม่มีงานซ่อม — เริ่มที่เมนู “รับแจ้งซ่อมใหม่”
          </p>
        )}
      </section>
    </div>
  );
}
