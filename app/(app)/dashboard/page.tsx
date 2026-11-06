import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PIPELINE, STATUS_LABEL, type RepairStatus } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { DocTag, Empty, PageHeader, Panel } from "@/components/ui";

type JobRow = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  received_at: string;
  updated_at: string;
  customers: { name: string } | null;
  tools: { brand: string; model: string } | null;
};

const SEGMENT_TONE: Record<RepairStatus, string> = {
  received: "bg-slate-400",
  quoting: "bg-amber",
  approved: "bg-sky-500",
  repairing: "bg-indigo-500",
  ready: "bg-emerald-500",
  delivered: "bg-zinc-400",
  cancelled: "bg-rose-400",
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: statusRows }, recentRes, staleRes] = await Promise.all([
    supabase.from("repair_jobs").select("status"),
    supabase
      .from("repair_jobs")
      .select("id, doc_no, status, received_at, updated_at, customers(name), tools(brand, model)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("repair_jobs")
      .select("id, doc_no, status, received_at, updated_at, customers(name), tools(brand, model)")
      .not("status", "in", "(delivered,cancelled)")
      .lt("updated_at", weekAgo)
      .order("updated_at", { ascending: true })
      .limit(8),
  ]);
  const recent = (recentRes.data ?? []) as unknown as JobRow[];
  const stale = (staleRes.data ?? []) as unknown as JobRow[];

  const counts = Object.fromEntries(PIPELINE.map((s) => [s, 0])) as Record<RepairStatus, number>;
  for (const row of statusRows ?? []) {
    const s = row.status as RepairStatus;
    if (s in counts) counts[s] += 1;
  }
  const open = PIPELINE.filter((s) => s !== "delivered").reduce((n, s) => n + counts[s], 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`สวัสดี ${profile.full_name}`} description={`มีงานที่ยังไม่ปิด ${open} งาน`} />

      {/* แถบขั้นตอนงานซ่อม: อ่านซ้ายไปขวาตามลำดับจริงของงาน */}
      <section className="panel overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE.map((s, i) => (
            <Link
              key={s}
              href={`/jobs?view=list&status=${s}`}
              className="group relative border-b border-r border-line px-5 py-4 transition-colors last:border-r-0 hover:bg-steel/50 lg:border-b-0"
            >
              <span className={`absolute inset-x-0 top-0 h-[3px] ${SEGMENT_TONE[s]}`} />
              <p className="text-[13px] text-muted">{STATUS_LABEL[s]}</p>
              <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-ink">{counts[s]}</p>
              {i < PIPELINE.length - 1 && (
                <ChevronRight
                  size={16}
                  className="absolute right-1 top-1/2 hidden -translate-y-1/2 text-line lg:block"
                  aria-hidden
                />
              )}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="รับเข้าล่าสุด"
          action={
            <Link href="/jobs?view=list" className="text-sm font-medium text-brand hover:underline">
              ดูทั้งหมด
            </Link>
          }
          bodyClassName=""
        >
          {recent.length > 0 ? (
            <ul className="divide-y divide-line/70">
              {recent.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-steel/40">
                    <DocTag>{j.doc_no}</DocTag>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{j.customers?.name}</p>
                      <p className="truncate text-xs text-muted">
                        {j.tools?.brand} {j.tools?.model}
                      </p>
                    </div>
                    <span className="hidden text-xs text-muted sm:block">{formatDate(j.received_at)}</span>
                    <StatusBadge status={j.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>ยังไม่มีงานซ่อม เริ่มที่ปุ่ม “รับแจ้งซ่อมใหม่”</Empty>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title={
            <>
              <Clock size={16} className="text-[#b07b00]" /> ค้างเกิน 7 วัน
            </>
          }
          bodyClassName=""
        >
          {stale.length > 0 ? (
            <ul className="divide-y divide-line/70">
              {stale.map((j) => {
                const days = Math.floor((Date.now() - new Date(j.updated_at).getTime()) / 86_400_000);
                return (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="flex items-center gap-3 border-l-[3px] border-amber px-5 py-3 hover:bg-steel/40">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[13px] font-semibold">{j.doc_no}</p>
                        <p className="truncate text-xs text-muted">
                          {STATUS_LABEL[j.status]} · {j.customers?.name}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-[#8a6100]">{days} วัน</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>ไม่มีงานค้างนาน</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}
