import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatPhone } from "@/lib/format";
import type { RepairStatus } from "@/lib/constants";
import type { Customer, Tool } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import EditCustomerForm from "./EditCustomerForm";
import UnlinkLineButton from "./UnlinkLineButton";
import { DeleteCustomerButton } from "@/components/DeleteButtons";
import { CustomerCarrierSelect } from "@/components/ShippingUI";
import type { Carrier } from "@/lib/shipping";

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
  const { data: carrierRows, error: carrierErr } = await supabase.from("carriers").select("*").order("sort");
  const carriers = (carrierRows ?? []) as Carrier[];
  const c = customer as Customer;
  const toolList = (tools ?? []) as Tool[];
  const jobList = (jobs ?? []) as JobRow[];

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> รายชื่อลูกค้า
      </Link>

      <header className="panel p-5">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{c.name}</h1>
        <p className="text-muted">
          {formatPhone(c.phone)}
          {c.line_id && ` · LINE: ${c.line_id}`}
        </p>
        {c.address && <p className="text-sm text-muted">{c.address}</p>}
        <p className="mt-1 text-xs text-zinc-400">
          ลงทะเบียน {formatDate(c.created_at)} · LINE แจ้งเตือน:{" "}
          {c.line_user_id ? "เชื่อมแล้ว " : "ยังไม่เชื่อม"}
          {c.line_user_id && Boolean(profile) && <UnlinkLineButton customerId={c.id} />}
        </p>
        {!carrierErr && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-muted">ขนส่งที่ใช้ประจำ:</span>
            <CustomerCarrierSelect
              customerId={c.id}
              value={(customer as { default_carrier_id?: string | null }).default_carrier_id ?? null}
              carriers={carriers}
              canEdit={Boolean(profile)}
            />
          </div>
        )}
        {Boolean(profile) && (
          <div className="mt-4">
            <EditCustomerForm customer={c} />
            {profile.role === "admin" && (
              <div className="mt-3 border-t border-line pt-3">
                <DeleteCustomerButton customerId={c.id} name={c.name} jobCount={jobList.length} />
              </div>
            )}
          </div>
        )}
      </header>

      <section className="panel">
        <h2 className="panel-head panel-title">เครื่องมือ ({toolList.length})</h2>
        <ul className="divide-y divide-line/70">
          {toolList.map((t) => {
            const count = jobList.filter((j) => j.tool_id === t.id).length;
            return (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{t.brand}</span> {t.model}
                  {t.serial_number && <span className="ml-2 font-mono text-xs text-muted">S/N {t.serial_number}</span>}
                </span>
                <span className="text-muted">ซ่อม {count} ครั้ง</span>
              </li>
            );
          })}
          {toolList.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">ยังไม่มีเครื่องมือ</li>}
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel-head panel-title">ประวัติงานซ่อม ({jobList.length})</h2>
        <ul className="divide-y divide-line/70">
          {jobList.map((j) => {
            const tool = toolList.find((t) => t.id === j.tool_id);
            return (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <Link href={`/jobs/${j.id}`} className="doc-tag hover:border-graphite/60">
                    {j.doc_no}
                  </Link>
                  <span className="ml-2 text-muted">{formatDate(j.received_at)}</span>
                  <p className="text-muted">
                    {tool ? `${tool.brand} ${tool.model} — ` : ""}
                    {j.issue_description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={j.status} />
                  <Link href={`/print/job/${j.id}`} className="text-muted hover:underline">
                    พิมพ์
                  </Link>
                </div>
              </li>
            );
          })}
          {jobList.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">ยังไม่มีงานซ่อม</li>}
        </ul>
      </section>
    </div>
  );
}
