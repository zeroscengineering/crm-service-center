import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleDot,
  FilePlus2,
  FileText,
  MessageCircle,
  NotebookPen,
  Package,
  Plus,
  StickyNote,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { STATUS_LABEL, type RepairStatus } from "@/lib/constants";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/quote";
import { DIRECTION_LABEL, SHIPMENT_STATUS_LABEL, type Carrier, type ShipmentDirection, type ShipmentStatus } from "@/lib/shipping";
import type { Tool } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { DocTag } from "@/components/ui";
import { DeleteCustomerButton } from "@/components/DeleteButtons";
import { CustomerCarrierSelect } from "@/components/ShippingUI";
import EditCustomerForm, { type EditableCustomer } from "./EditCustomerForm";
import UnlinkLineButton from "./UnlinkLineButton";
import { CopyValue, CustomerNoteForm, CustomerTagPicker, DeleteNoteButton, type Tag } from "./CustomerWidgets";

export const dynamic = "force-dynamic";

type CustomerRow = EditableCustomer & {
  line_user_id: string | null;
  created_at: string;
  default_carrier_id?: string | null;
};
type JobRow = { id: string; doc_no: string; status: RepairStatus; received_at: string; issue_description: string; tool_id: string; quotation_price: number | null };
type TLEvent = { at: string; kind: "status" | "quote" | "ship" | "note" | "chat-in" | "chat-out"; title: string; detail?: string; href?: string; by?: string | null };

const KIND_ICON = {
  status: Wrench,
  quote: FileText,
  ship: Package,
  note: StickyNote,
  "chat-in": MessageCircle,
  "chat-out": MessageCircle,
} as const;

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-zinc-400">-</span>}</dd>
    </div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: customer }, { data: tools }, { data: jobs }, { data: staffRows }, carrierRes, tagRes, ctRes, noteRes] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).maybeSingle(),
      supabase.from("tools").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase
        .from("repair_jobs")
        .select("id, doc_no, status, received_at, issue_description, tool_id, quotation_price")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("carriers").select("*").order("sort"),
      supabase.from("tags").select("id, name, color").order("name"),
      supabase.from("customer_tags").select("tag_id").eq("customer_id", id),
      supabase
        .from("customer_notes")
        .select("id, body, created_at, profiles(full_name)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
    ]);
  if (!customer) notFound();

  const c = customer as unknown as CustomerRow;
  const toolList = (tools ?? []) as unknown as Tool[];
  const jobList = (jobs ?? []) as unknown as JobRow[];
  const staff = (staffRows ?? []).map((s) => ({ id: s.id as string, name: s.full_name as string }));
  const owner = staff.find((s) => s.id === c.owner_id);
  const carriers = (carrierRes.data ?? []) as unknown as Carrier[];
  const profileReady = !ctRes.error && !noteRes.error; // รัน SQL 0008 แล้ว
  const allTags = (tagRes.data ?? []) as unknown as Tag[];
  const myTags = (ctRes.data ?? []).map((r) => r.tag_id as string);
  const notes = (noteRes.data ?? []) as unknown as { id: string; body: string; created_at: string; profiles: { full_name: string } | null }[];

  // ---------- ไทม์ไลน์ ----------
  const jobIds = jobList.map((j) => j.id);
  const docById = new Map(jobList.map((j) => [j.id, j.doc_no]));
  const [histRes, quoteRes, shipRes, chatRes] = await Promise.all([
    jobIds.length
      ? supabase
          .from("job_status_history")
          .select("repair_job_id, to_status, created_at, profiles(full_name)")
          .in("repair_job_id", jobIds)
          .order("created_at", { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] }),
    supabase
      .from("quotations")
      .select("id, quote_no, status, grand_total, created_at, repair_job_id")
      .or(`customer_id.eq.${id}${jobIds.length ? `,repair_job_id.in.(${jobIds.join(",")})` : ""}`)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("shipments")
      .select("direction, status, tracking_no, created_at, repair_job_id")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    c.line_user_id
      ? supabase
          .from("chat_messages")
          .select("direction, msg_type, text, created_at")
          .eq("line_user_id", c.line_user_id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  const events: TLEvent[] = [];
  for (const h of (histRes.data ?? []) as unknown as { repair_job_id: string; to_status: RepairStatus; created_at: string; profiles: { full_name: string } | null }[]) {
    events.push({
      at: h.created_at,
      kind: "status",
      title: `${docById.get(h.repair_job_id) ?? ""} ${STATUS_LABEL[h.to_status]}`,
      href: `/jobs/${h.repair_job_id}`,
      by: h.profiles?.full_name,
    });
  }
  for (const q of (quoteRes.data ?? []) as unknown as { id: string; quote_no: string; status: QuoteStatus; grand_total: number; created_at: string }[]) {
    events.push({
      at: q.created_at,
      kind: "quote",
      title: `ใบเสนอราคา ${q.quote_no}`,
      detail: `${QUOTE_STATUS_LABEL[q.status]} ฿${formatMoney(q.grand_total)}`,
      href: `/quotes/${q.id}`,
    });
  }
  for (const s of (shipRes.data ?? []) as unknown as { direction: ShipmentDirection; status: ShipmentStatus; tracking_no: string | null; created_at: string; repair_job_id: string | null }[]) {
    events.push({
      at: s.created_at,
      kind: "ship",
      title: `${DIRECTION_LABEL[s.direction]} ${s.repair_job_id ? docById.get(s.repair_job_id) ?? "" : ""}`,
      detail: `${SHIPMENT_STATUS_LABEL[s.status]}${s.tracking_no ? ` เลขพัสดุ ${s.tracking_no}` : ""}`,
      href: s.repair_job_id ? `/jobs/${s.repair_job_id}` : undefined,
    });
  }
  for (const n of notes) events.push({ at: n.created_at, kind: "note", title: "โน้ตภายใน", detail: n.body, by: n.profiles?.full_name });
  for (const m of (chatRes.data ?? []) as unknown as { direction: "in" | "out"; msg_type: string; text: string | null; created_at: string }[]) {
    events.push({
      at: m.created_at,
      kind: m.direction === "in" ? "chat-in" : "chat-out",
      title: m.direction === "in" ? "ลูกค้าทักทาง LINE" : "ร้านตอบทาง LINE",
      detail: m.msg_type === "text" ? m.text ?? "" : `[${m.msg_type}]`,
      href: c.line_user_id ? `/chat?c=${encodeURIComponent(c.line_user_id)}` : undefined,
    });
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  const timeline = events.slice(0, 60);

  const openJobs = jobList.filter((j) => j.status !== "delivered" && j.status !== "cancelled");
  const displayName = c.company_name ? c.company_name : c.name;

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> รายชื่อลูกค้า
      </Link>

      {/* ---------- หัวโปรไฟล์ ---------- */}
      <header className="panel flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{displayName}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {c.company_name ? `${c.contact_person || c.name}  ` : ""}
            {formatPhone(c.phone)}
            {owner && `  ผู้ดูแล ${owner.name}`}
          </p>
          <div className="mt-3">
            {profileReady ? (
              <CustomerTagPicker customerId={c.id} allTags={allTags} selected={myTags} />
            ) : (
              <p className="text-xs text-muted">แท็กและโน้ตภายใน: รัน SQL 0008 ก่อน</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/jobs/new?customer=${c.id}`} className="btn btn-primary">
            <Plus size={16} /> สร้างดีล (รับแจ้งซ่อม)
          </Link>
          <Link href={`/quotes/new?customer=${c.id}`} className="btn btn-secondary">
            <FilePlus2 size={16} /> ใบเสนอราคา
          </Link>
          {c.line_user_id && (
            <Link href={`/chat?c=${encodeURIComponent(c.line_user_id)}`} className="btn btn-line">
              <MessageCircle size={16} /> แชท LINE
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- ซ้าย: ข้อมูลติดต่อ ---------- */}
        <div className="space-y-6">
          <Panel title="ข้อมูลติดต่อ">
            <dl className="divide-y divide-line/60">
              <Info label="ชื่อลูกค้า">{c.name}</Info>
              <Info label="บริษัท / ร้าน">{c.company_name}</Info>
              <Info label="ผู้ติดต่อ">{c.contact_person}</Info>
              <Info label="เบอร์โทร">
                <a href={`tel:${c.phone}`} className="font-medium text-brand hover:underline">
                  {formatPhone(c.phone)}
                </a>
              </Info>
              <Info label="อีเมล">{c.email && <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>}</Info>
              <Info label="ที่อยู่">{c.address}</Info>
              <Info label="เลขผู้เสียภาษี">
                {c.tax_id && (
                  <span className="font-mono">
                    {c.tax_id}
                    {c.tax_branch ? ` (${c.tax_branch})` : ""}
                  </span>
                )}
              </Info>
              <Info label="ผู้ดูแล">{owner?.name}</Info>
              <Info label="LINE ID">{c.line_id}</Info>
              <Info label="LINE UID">
                {c.line_user_id ? (
                  <div className="space-y-1">
                    <CopyValue value={c.line_user_id} />
                    <p className="text-xs text-emerald-700">
                      เชื่อมแจ้งเตือนแล้ว <UnlinkLineButton customerId={c.id} />
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-muted">ยังไม่เชื่อม (ให้ลูกค้าแอด LINE แล้วพิมพ์เลขที่เอกสาร)</span>
                )}
              </Info>
              {!carrierRes.error && (
                <Info label="ขนส่งประจำ">
                  <CustomerCarrierSelect customerId={c.id} value={c.default_carrier_id ?? null} carriers={carriers} canEdit />
                </Info>
              )}
              <Info label="ลงทะเบียน">{formatDate(c.created_at)}</Info>
            </dl>
            <div className="mt-4 space-y-3">
              <EditCustomerForm customer={c} staff={staff} />
              {profile.role === "admin" && (
                <div className="border-t border-line pt-3">
                  <DeleteCustomerButton customerId={c.id} name={c.name} jobCount={jobList.length} />
                </div>
              )}
            </div>
          </Panel>

          <Panel title={`เครื่องมือ (${toolList.length})`} icon={<Wrench size={16} className="text-muted" />}>
            <ul className="divide-y divide-line/60">
              {toolList.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{t.brand}</span> {t.model}
                    {t.serial_number && <span className="block font-mono text-xs text-muted">S/N {t.serial_number}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">ซ่อม {jobList.filter((j) => j.tool_id === t.id).length} ครั้ง</span>
                </li>
              ))}
              {toolList.length === 0 && <li className="py-3 text-sm text-muted">ยังไม่มีเครื่องมือ</li>}
            </ul>
          </Panel>
        </div>

        {/* ---------- ขวา ---------- */}
        <div className="space-y-6 lg:col-span-2">
          <Panel
            title={`ดีล / งานซ่อม (${jobList.length})`}
            icon={<CircleDot size={16} className="text-muted" />}
            action={<span className="text-xs text-muted">ยังไม่ปิด {openJobs.length} งาน</span>}
          >
            <ul className="divide-y divide-line/60">
              {jobList.map((j) => {
                const tool = toolList.find((t) => t.id === j.tool_id);
                return (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="-mx-2 flex flex-wrap items-center gap-3 rounded-md px-2 py-2.5 hover:bg-steel/50">
                      <DocTag>{j.doc_no}</DocTag>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium">{tool ? `${tool.brand} ${tool.model}` : "-"}</p>
                        <p className="truncate text-xs text-muted">{j.issue_description}</p>
                      </div>
                      {j.quotation_price !== null && (
                        <span className="font-mono text-sm tabular-nums">฿{formatMoney(j.quotation_price)}</span>
                      )}
                      <span className="text-xs text-muted">{formatDate(j.received_at)}</span>
                      <StatusBadge status={j.status} />
                    </Link>
                  </li>
                );
              })}
              {jobList.length === 0 && (
                <li className="py-4 text-sm text-muted">
                  ยังไม่มีดีล{" "}
                  <Link href={`/jobs/new?customer=${c.id}`} className="font-medium text-brand hover:underline">
                    สร้างดีลแรก
                  </Link>
                </li>
              )}
            </ul>
          </Panel>

          <Panel title={`โน้ตภายใน (${notes.length})`} icon={<NotebookPen size={16} className="text-muted" />}>
            {profileReady ? (
              <div className="space-y-4">
                <CustomerNoteForm customerId={c.id} />
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="group rounded-md border border-line bg-[#fbf7e9]/60 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                        <DeleteNoteButton customerId={c.id} noteId={n.id} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {n.profiles?.full_name ?? "-"} {formatDateTime(n.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted">รัน SQL 0008_customer_profile.sql ก่อน เพื่อใช้โน้ตภายใน</p>
            )}
          </Panel>

          <Panel title="ไทม์ไลน์">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีความเคลื่อนไหว</p>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-line pl-6">
                {timeline.map((e, i) => {
                  const Icon = KIND_ICON[e.kind];
                  const body = (
                    <>
                      <p className="text-sm font-medium">{e.title}</p>
                      {e.detail && <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted">{e.detail}</p>}
                      <p className="text-xs text-zinc-400">
                        {formatDateTime(e.at)}
                        {e.by ? `  ${e.by}` : ""}
                      </p>
                    </>
                  );
                  return (
                    <li key={i} className="relative">
                      <span
                        className={`absolute -left-[2.05rem] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${
                          e.kind.startsWith("chat") ? "bg-[#06C755] text-white" : e.kind === "note" ? "bg-amber text-graphite" : "bg-graphite text-white"
                        }`}
                      >
                        <Icon size={12} />
                      </span>
                      {e.href ? (
                        <Link href={e.href} className="block rounded-md hover:bg-steel/40">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
