import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { STATUSES, STATUS_LABEL, type RepairStatus } from "@/lib/constants";
import { cleanSearch, formatDate, formatPhone } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import KanbanBoard, { type BoardJob } from "@/components/KanbanBoard";

type Row = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  received_at: string;
  updated_at: string;
  technician_name: string | null;
  customers: { name: string; phone: string } | null;
  tools: { brand: string; model: string; serial_number: string | null } | null;
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>;
}) {
  const profile = await requireProfile();
  const { q = "", status = "", view = "board" } = await searchParams;
  const supabase = await createClient();
  const isBoard = view !== "list";
  const canEdit = profile.role === "admin";

  const tabs = (
    <div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-sm">
      <Link href="/jobs" className={`rounded-md px-3 py-1.5 ${isBoard ? "bg-graphite text-white" : "text-muted hover:text-ink"}`}>
        Pipeline
      </Link>
      <Link
        href="/jobs?view=list"
        className={`rounded-md px-3 py-1.5 ${!isBoard ? "bg-graphite text-white" : "text-muted hover:text-ink"}`}
      >
        ตาราง
      </Link>
    </div>
  );

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">งานซ่อม</h1>
        {tabs}
      </div>
    </header>
  );

  if (isBoard) {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data } = await supabase
      .from("repair_jobs")
      .select("id, doc_no, status, received_at, updated_at, technician_name, quotation_price, customers(name), tools(brand, model)")
      .neq("status", "cancelled")
      .or(`status.neq.delivered,updated_at.gte."${since}"`)
      .order("received_at", { ascending: true })
      .limit(500);

    const rows = (data ?? []) as unknown as (Row & { customers: { name: string } | null; quotation_price: number | null })[];
    const ids = rows.map((r) => r.id);
    const totals = new Map<string, number>();
    if (ids.length) {
      const { data: t } = await supabase
        .from("repair_job_totals")
        .select("repair_job_id, grand_total")
        .in("repair_job_id", ids);
      for (const r of t ?? []) totals.set(r.repair_job_id as string, Number(r.grand_total));
    }

    const jobs: BoardJob[] = rows.map((r) => ({
      id: r.id,
      doc_no: r.doc_no,
      status: r.status,
      received_at: r.received_at,
      updated_at: r.updated_at,
      technician_name: r.technician_name,
      customer_name: r.customers?.name ?? "-",
      tool_label: `${r.tools?.brand ?? ""} ${r.tools?.model ?? ""}`.trim(),
      total: totals.get(r.id) || Number(r.quotation_price ?? 0),
    }));

    return (
      <div className="space-y-6">
        {header}
        <p className="text-xs text-muted">
          คอลัมน์ “ส่งมอบเรียบร้อย” แสดงเฉพาะ 30 วันล่าสุด · งานที่ยกเลิกดูได้ในมุมมองตาราง
        </p>
        <KanbanBoard jobs={jobs} canEdit={canEdit} />
      </div>
    );
  }

  let query = supabase
    .from("repair_jobs")
    .select(
      "id, doc_no, status, received_at, updated_at, technician_name, customers(name, phone), tools(brand, model, serial_number)",
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
      {header}

      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="view" value="list" />
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาเลขที่เอกสาร"
          className="w-64 rounded-lg border border-line bg-white px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary">ค้นหา</button>
      </form>

      <div className="overflow-x-auto panel">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-steel/60 text-left text-[13px] text-muted">
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
          <tbody className="divide-y divide-line/70">
            {rows.map((j) => (
              <tr key={j.id}>
                <td className="px-4 py-2 font-mono">
                  <Link href={`/jobs/${j.id}`} className="font-semibold text-brand hover:underline">
                    {j.doc_no}
                  </Link>
                </td>
                <td className="px-4 py-2">{formatDate(j.received_at)}</td>
                <td className="px-4 py-2">
                  {j.customers?.name}
                  <span className="block text-xs text-muted">{formatPhone(j.customers?.phone)}</span>
                </td>
                <td className="px-4 py-2">
                  {j.tools?.brand} {j.tools?.model}
                  {j.tools?.serial_number && (
                    <span className="block font-mono text-xs text-muted">S/N {j.tools.serial_number}</span>
                  )}
                </td>
                <td className="px-4 py-2">{j.technician_name ?? "-"}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={j.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/print/job/${j.id}`} className="text-muted hover:underline">
                    พิมพ์
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
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
