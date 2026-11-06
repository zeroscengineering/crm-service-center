"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import {
  addShipment,
  deleteCarrier,
  deleteShipment,
  notifyShipment,
  saveCarrier,
  setCustomerCarrier,
  updateShipment,
  type ShipResult,
} from "@/app/(app)/shipping/actions";
import {
  DIRECTION_LABEL,
  SHIPMENT_STATUS_COLOR,
  SHIPMENT_STATUS_LABEL,
  trackingLink,
  type Carrier,
  type Shipment,
  type ShipmentStatus,
} from "@/lib/shipping";

const input =
  "w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-graphite focus:ring-2 focus:ring-graphite/10";

function submitter(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

// ======================= ตั้งค่าขนส่ง =======================
export function CarrierForm({ carrier }: { carrier?: Carrier }) {
  const [state, action, pending] = useActionState<ShipResult, FormData>(saveCarrier, {});
  const [del, startDel] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !carrier) ref.current?.reset();
  }, [state, carrier]);

  return (
    <form
      ref={ref}
      onSubmit={submitter(action)}
      className="grid items-center gap-2 border-b border-zinc-100 py-2 sm:grid-cols-[2fr_3fr_1.2fr_60px_auto_auto]"
    >
      {carrier && <input type="hidden" name="id" value={carrier.id} />}
      <input name="name" defaultValue={carrier?.name} placeholder="ชื่อขนส่ง" className={input} />
      <input
        name="tracking_url"
        defaultValue={carrier?.tracking_url ?? ""}
        placeholder="ลิงก์ติดตาม เช่น https://.../?no={tracking}"
        className={`${input} font-mono text-xs`}
      />
      <input name="phone" defaultValue={carrier?.phone ?? ""} placeholder="เบอร์ติดต่อ" className={input} />
      <input name="sort" type="number" defaultValue={carrier?.sort ?? 100} title="ลำดับ" className={input} />
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" name="active" defaultChecked={carrier?.active ?? true} /> ใช้งาน
      </label>
      <div className="flex items-center gap-2">
        <button disabled={pending} className="btn btn-dark btn-sm disabled:opacity-60">
          {carrier ? "บันทึก" : "+ เพิ่ม"}
        </button>
        {carrier && (
          <button
            type="button"
            disabled={del}
            onClick={() => {
              if (confirm(`ลบ ${carrier.name}? (รายการขนส่งเดิมจะไม่ถูกลบ)`)) startDel(async () => void (await deleteCarrier(carrier.id)));
            }}
            className="text-xs text-rose-600 hover:underline"
          >
            ลบ
          </button>
        )}
        {state.error && <span className="text-xs text-rose-600">{state.error}</span>}
        {state.ok && <span className="text-xs text-emerald-600"></span>}
      </div>
    </form>
  );
}

// ======================= ลูกค้า × ขนส่ง =======================
export function CustomerCarrierSelect({
  customerId,
  value,
  carriers,
  canEdit,
}: {
  customerId: string;
  value: string | null;
  carriers: Carrier[];
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [v, setV] = useState(value ?? "");
  const current = carriers.find((c) => c.id === value);
  if (!canEdit) return <span>{current?.name ?? "-"}</span>;
  return (
    <select
      value={v}
      disabled={pending}
      onChange={(e) => {
        setV(e.target.value);
        start(async () => void (await setCustomerCarrier(customerId, e.target.value || null)));
      }}
      className="rounded-lg border border-line bg-white px-2 py-1 text-sm"
    >
      <option value="">— ยังไม่ระบุ —</option>
      {carriers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.active ? "" : " (ปิดใช้)"}
        </option>
      ))}
    </select>
  );
}

// ======================= แถวรายการขนส่ง (แก้ชื่อคนส่ง/สถานะ) =======================
export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SHIPMENT_STATUS_COLOR[status]}`}>
      {SHIPMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function SenderNameEditor({ shipment, canEdit }: { shipment: Shipment; canEdit: boolean }) {
  const [v, setV] = useState(shipment.sender_name ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  if (!canEdit) return <span>{shipment.sender_name ?? "-"}</span>;
  const dirty = v.trim() !== (shipment.sender_name ?? "");
  return (
    <div className="flex items-center gap-1">
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setSaved(false);
        }}
        placeholder="ใส่ชื่อคนส่ง"
        className="w-36 rounded-md border border-line px-2 py-1 text-sm"
      />
      {dirty && (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateShipment(shipment.id, { sender_name: v });
              setSaved(!r.error);
            })
          }
          className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-white disabled:opacity-60"
        >
          บันทึก
        </button>
      )}
      {saved && !dirty && <span className="text-xs text-emerald-600"></span>}
    </div>
  );
}

export function ShipmentStatusSelect({ shipment, canEdit }: { shipment: Shipment; canEdit: boolean }) {
  const [pending, start] = useTransition();
  if (!canEdit) return <ShipmentStatusBadge status={shipment.status} />;
  return (
    <select
      defaultValue={shipment.status}
      disabled={pending}
      onChange={(e) => start(async () => void (await updateShipment(shipment.id, { status: e.target.value as ShipmentStatus })))}
      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SHIPMENT_STATUS_COLOR[shipment.status]}`}
    >
      {(Object.keys(SHIPMENT_STATUS_LABEL) as ShipmentStatus[]).map((s) => (
        <option key={s} value={s}>
          {SHIPMENT_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

export function ShipmentActions({ shipment, canNotify }: { shipment: Shipment; canNotify: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {canNotify && shipment.direction === "outbound" && (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await notifyShipment(shipment.id);
              setMsg(r.error ? { ok: false, t: r.error } : { ok: true, t: r.info ?? "" });
            })
          }
          className="rounded-md bg-[#06C755] px-2 py-1 font-medium text-white disabled:opacity-60"
        >
          <MessageCircle size={12} /> แจ้งเลขพัสดุทาง LINE
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => {
          if (confirm("ลบรายการขนส่งนี้?")) start(async () => void (await deleteShipment(shipment.id)));
        }}
        className="text-rose-600 hover:underline"
      >
        ลบ
      </button>
      {msg && <span className={msg.ok ? "text-emerald-600" : "text-rose-600"}>{msg.t}</span>}
    </div>
  );
}

// ======================= การ์ดขนส่งในหน้างาน =======================
export function JobShippingPanel({
  jobId,
  customerId,
  jobs,
  shipments,
  carriers,
  defaultCarrierId,
  canEdit,
}: {
  /** หน้างานซ่อม: ผูกกับงานนี้ */
  jobId?: string;
  /** หน้าแชท/ลูกค้า: ผูกกับลูกค้า และเลือกงานได้ */
  customerId?: string;
  jobs?: { id: string; doc_no: string }[];
  shipments: Shipment[];
  carriers: Carrier[];
  defaultCarrierId: string | null;
  canEdit: boolean;
}) {
  const docById = new Map((jobs ?? []).map((j) => [j.id, j.doc_no]));
  const [state, action, pending] = useActionState<ShipResult, FormData>(addShipment, {});
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);
  const byId = new Map(carriers.map((c) => [c.id, c]));
  const active = carriers.filter((c) => c.active);
  const defaultCarrier = defaultCarrierId ? byId.get(defaultCarrierId) : null;

  return (
    <div className="space-y-3">
      {defaultCarrier && <p className="text-xs text-muted">ขนส่งที่ลูกค้าใช้ประจำ: {defaultCarrier.name}</p>}
      <ul className="space-y-2">
        {shipments.map((s) => {
          const c = s.carrier_id ? byId.get(s.carrier_id) : null;
          const link = trackingLink(c, s.tracking_no);
          return (
            <li key={s.id} className="space-y-1.5 rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {DIRECTION_LABEL[s.direction]} · {c?.name ?? "ไม่ระบุขนส่ง"}
                  {jobs && s.repair_job_id && docById.get(s.repair_job_id) && (
                    <span className="ml-1 font-mono text-xs text-muted">{docById.get(s.repair_job_id)}</span>
                  )}
                </span>
                <ShipmentStatusSelect shipment={s} canEdit={canEdit} />
              </div>
              {s.tracking_no && (
                <p className="font-mono text-xs">
                  เลขพัสดุ:{" "}
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                      {s.tracking_no}                     </a>
                  ) : (
                    s.tracking_no
                  )}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted">
                คนส่ง: <SenderNameEditor shipment={s} canEdit={canEdit} />
              </div>
              {s.note && <p className="text-xs text-muted">{s.note}</p>}
              {canEdit && <ShipmentActions shipment={s} canNotify />}
            </li>
          );
        })}
        {shipments.length === 0 && <li className="text-xs text-zinc-400">ยังไม่มีรายการขนส่ง</li>}
      </ul>

      {canEdit &&
        (open ? (
          <form ref={ref} onSubmit={submitter(action)} className="space-y-2 rounded-lg bg-steel/50 p-3">
            {jobId ? (
              <input type="hidden" name="repair_job_id" value={jobId} />
            ) : (
              <>
                <input type="hidden" name="customer_id" value={customerId ?? ""} />
                <select name="repair_job_id" defaultValue={jobs?.[0]?.id ?? ""} className={input}>
                  <option value="">ไม่ผูกกับงานซ่อม</option>
                  {(jobs ?? []).map((j) => (
                    <option key={j.id} value={j.id}>
                      งาน {j.doc_no}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select name="direction" defaultValue="outbound" className={input}>
                <option value="outbound">{DIRECTION_LABEL.outbound}</option>
                <option value="inbound">{DIRECTION_LABEL.inbound}</option>
              </select>
              <select name="carrier_id" defaultValue={defaultCarrierId ?? ""} className={input}>
                <option value="">— เลือกขนส่ง —</option>
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input name="tracking_no" placeholder="เลขพัสดุ (ถ้ามี)" className={`${input} font-mono`} />
              <input name="sender_name" placeholder="ชื่อคนส่ง (ใส่ทีหลังได้)" className={input} />
              <select name="status" defaultValue="pending" className={input}>
                {(Object.keys(SHIPMENT_STATUS_LABEL) as ShipmentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {SHIPMENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <input name="cost" type="number" step="any" min="0" placeholder="ค่าส่ง (บาท)" className={input} />
            </div>
            <input name="note" placeholder="หมายเหตุ" className={input} />
            <div className="flex items-center gap-3">
              <button disabled={pending} className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                {pending ? "..." : "บันทึก"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:underline">
                ยกเลิก
              </button>
              {state.error && <span className="text-sm text-rose-600">{state.error}</span>}
            </div>
          </form>
        ) : (
          <button onClick={() => setOpen(true)} className="text-sm text-brand hover:underline">
            + เพิ่มรายการขนส่ง
          </button>
        ))}
    </div>
  );
}
