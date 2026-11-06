import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ContactRound, NotebookPen, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatPhone } from "@/lib/format";
import type { Carrier, Shipment } from "@/lib/shipping";
import { JobShippingPanel } from "@/components/ShippingUI";
import EditCustomerForm, { type EditableCustomer } from "../customers/[id]/EditCustomerForm";
import { CopyValue, CustomerNoteForm, DeleteNoteButton } from "../customers/[id]/CustomerWidgets";

/** กล่องพับได้ในแถบขวาของหน้าแชท */
function Section({ title, icon, count, open, children }: { title: string; icon: ReactNode; count?: number; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group border-t border-line pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-muted [&::-webkit-details-marker]:hidden">
        {icon}
        <span className="flex-1">
          {title}
          {count !== undefined && <span className="ml-1 text-zinc-400">({count})</span>}
        </span>
        <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 py-1 text-xs">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

export default async function ChatCustomerPanel({
  customerId,
  lineUserId,
  jobs,
  canEdit,
}: {
  customerId: string;
  lineUserId: string;
  jobs: { id: string; doc_no: string }[];
  canEdit: boolean;
}) {
  const supabase = await createClient();
  const [{ data: cust }, { data: staffRows }, noteRes, shipRes, carrierRes] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("customer_notes")
      .select("id, body, created_at, profiles(full_name)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("shipments").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(20),
    supabase.from("carriers").select("*").order("sort").order("name"),
  ]);
  if (!cust) return null;

  const c = cust as unknown as EditableCustomer & { default_carrier_id?: string | null };
  const staff = (staffRows ?? []).map((s) => ({ id: s.id as string, name: s.full_name as string }));
  const owner = staff.find((s) => s.id === c.owner_id);
  const notesReady = !noteRes.error;
  const notes = (noteRes.data ?? []) as unknown as { id: string; body: string; created_at: string; profiles: { full_name: string } | null }[];
  const shippingReady = !shipRes.error && !carrierRes.error;
  const shipments = (shipRes.data ?? []) as unknown as Shipment[];
  const carriers = (carrierRes.data ?? []) as unknown as Carrier[];

  return (
    <div className="space-y-3">
      {/* ข้อมูลติดต่อ */}
      <Section title="ข้อมูลติดต่อ" icon={<ContactRound size={14} />} open>
        <dl>
          <Row label="บริษัท">{c.company_name}</Row>
          <Row label="ผู้ติดต่อ">{c.contact_person}</Row>
          <Row label="เบอร์โทร">
            <a href={`tel:${c.phone}`} className="font-medium text-brand hover:underline">
              {formatPhone(c.phone)}
            </a>
          </Row>
          <Row label="อีเมล">{c.email}</Row>
          <Row label="ที่อยู่">{c.address}</Row>
          <Row label="เลขภาษี">{c.tax_id && `${c.tax_id}${c.tax_branch ? ` (${c.tax_branch})` : ""}`}</Row>
          <Row label="ผู้ดูแล">{owner?.name}</Row>
          <Row label="LINE UID">
            <CopyValue value={lineUserId} />
          </Row>
        </dl>
        {canEdit && (
          <div className="mt-2 [&_.grid]:grid-cols-1">
            <EditCustomerForm customer={c} staff={staff} />
          </div>
        )}
      </Section>

      {/* โน้ตภายใน */}
      <Section title="โน้ตภายใน" icon={<NotebookPen size={14} />} count={notes.length} open>
        {notesReady ? (
          <div className="space-y-2">
            {canEdit && <CustomerNoteForm customerId={customerId} />}
            <ul className="space-y-1.5">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md border border-line bg-[#fbf7e9]/60 px-3 py-2">
                  <div className="flex items-start justify-between gap-1">
                    <p className="whitespace-pre-wrap text-xs">{n.body}</p>
                    {canEdit && <DeleteNoteButton customerId={customerId} noteId={n.id} />}
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {n.profiles?.full_name ?? "-"} {formatDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted">รัน SQL 0008_customer_profile.sql ก่อน เพื่อใช้โน้ตภายใน</p>
        )}
      </Section>

      {/* การส่งของ */}
      <Section title="การส่งของ" icon={<Truck size={14} />} count={shipments.length} open={shipments.length > 0}>
        {shippingReady ? (
          <div className="[&_.grid]:grid-cols-1">
            <JobShippingPanel
              customerId={customerId}
              jobs={jobs}
              shipments={shipments}
              carriers={carriers}
              defaultCarrierId={c.default_carrier_id ?? null}
              canEdit={canEdit}
            />
          </div>
        ) : (
          <p className="text-xs text-muted">รัน SQL 0004_tags_shipping.sql ก่อน เพื่อใช้ระบบขนส่ง</p>
        )}
      </Section>

      <Link href={`/customers/${customerId}`} className="block border-t border-line pt-3 text-xs text-brand hover:underline">
        เปิดหน้าลูกค้าแบบเต็ม (ไทม์ไลน์ แท็ก ใบเสนอราคา)
      </Link>
    </div>
  );
}
