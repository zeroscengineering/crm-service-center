import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatPhone } from "@/lib/format";
import type { RepairStatus } from "@/lib/constants";
import type { Customer, Tool } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import EditCustomerForm from "./EditCustomerForm";
import UnlinkLineButton from "./UnlinkLineButton";

type JobRow = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  received_at: string;
  issue_description: string;
  tool_id: string;
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: customer }, { data: tools }, { data: jobs }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("tools").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase
      .from("repair_jobs")
      .select("id, doc_no, status, received_at, issue_description, tool_id")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) notFound();
  const c = customer as Customer;
  const toolList = (tools ?? []) as Tool[];
  const jobList = (jobs ?? []) as JobRow[];

  return (
    <div className="space-y-6">
      <Link href="/customers" className="text-sm text-zinc-500 hover:underline">
        ← กลับไปรายชื่อลูกค้า
      </Link>

      <header className="rounded-xl border border-zinc-200 bg-white p-5">
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <p className="text-zinc-600">
          {formatPhone(c.phone)}
          {c.line_id && ` · LINE: ${c.line_id}`}
        </p>
        {c.address && <p className="text-sm text-zinc-500">{c.address}</p>}
        <p className="mt-1 text-xs text-zinc-400">
          ลงทะเบียน {formatDate(c.created_at)} · LINE แจ้งเตือน:{" "}
          {c.line_user_id ? "เชื่อมแล้ว ✅" : "ยังไม่เชื่อม"}
          {c.line_user_id && profile.role === "admin" && <UnlinkLineButton customerId={c.id} />}
        </p>
        {profile.role === "admin" && (
          <div className="mt-4">
            <EditCustomerForm customer={c} />
          </div>
        )}
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">เครื่องมือ ({toolList.length})</h2>
        <ul className="divide-y divide-zinc-100">
          {toolList.map((t) => {
            const count = jobList.filter((j) => j.tool_id === t.id).length;
            return (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{t.brand}</span> {t.model}
                  {t.serial_number && <span className="ml-2 font-mono text-xs text-zinc-500">S/N {t.serial_number}</span>}
                </span>
                <span className="text-zinc-500">ซ่อม {count} ครั้ง</span>
              </li>
            );
          })}
          {toolList.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">ยังไม่มีเครื่องมือ</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">ประวัติงานซ่อม ({jobList.length})</h2>
        <ul className="divide-y divide-zinc-100">
          {jobList.map((j) => {
            const tool = toolList.find((t) => t.id === j.tool_id);
            return (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <Link href={`/jobs/${j.id}`} className="font-mono font-medium text-brand hover:underline">
                    {j.doc_no}
                  </Link>
                  <span className="ml-2 text-zinc-500">{formatDate(j.received_at)}</span>
                  <p className="text-zinc-600">
                    {tool ? `${tool.brand} ${tool.model} — ` : ""}
                    {j.issue_description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={j.status} />
                  <Link href={`/print/job/${j.id}`} className="text-zinc-500 hover:underline">
                    พิมพ์
                  </Link>
                </div>
              </li>
            );
          })}
          {jobList.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">ยังไม่มีงานซ่อม</li>}
        </ul>
      </section>
    </div>
  );
}
