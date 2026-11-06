"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addNote,
  addPart,
  deletePart,
  updateCosts,
  updateJobInfo,
  updateStatus,
  type ActionResult,
} from "../actions";
import { PIPELINE, STATUS_LABEL, WARRANTY_LABEL, type RepairStatus } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

const input =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/** ส่งฟอร์มแบบไม่ให้ React ล้างค่าเมื่อเกิด error */
function useFormSubmit(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

function Msg({ state }: { state: ActionResult }) {
  if (state.error) return <span className="text-sm text-rose-600">{state.error}</span>;
  if (state.ok) return <span className="text-sm text-emerald-600">บันทึกแล้ว ✓</span>;
  return null;
}

// ======================= สถานะ =======================
export function StatusControl({ jobId, status }: { jobId: string; status: RepairStatus }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const idx = PIPELINE.indexOf(status);
  const next = idx >= 0 && idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null;

  function change(s: RepairStatus) {
    if (s === status) return;
    if (s === "cancelled" && !confirm("ยืนยันยกเลิกงานซ่อมนี้?")) return;
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await updateStatus(jobId, s);
      if (res.error) setError(res.error);
      if (res.info) setInfo(res.info);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next && status !== "cancelled" && (
        <button
          onClick={() => change(next)}
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : `ถัดไป → ${STATUS_LABEL[next]}`}
        </button>
      )}
      <select
        value={status}
        disabled={pending}
        onChange={(e) => change(e.target.value as RepairStatus)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
      >
        {PIPELINE.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
        <option value="cancelled">{STATUS_LABEL.cancelled}</option>
      </select>
      {error && <span className="text-sm text-rose-600">{error}</span>}
      {info && <span className="text-sm text-emerald-700">💬 {info}</span>}
    </div>
  );
}

// ======================= ข้อมูลงาน =======================
export function JobInfoForm({
  job,
  technicians,
}: {
  job: {
    id: string;
    issue_description: string;
    warranty: keyof typeof WARRANTY_LABEL;
    technician_id: string | null;
    repair_notes: string | null;
    accessories: string[];
    received_documents: string[];
  };
  technicians: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateJobInfo, {});
  const onSubmit = useFormSubmit(action);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-brand hover:underline">
        แก้ไขข้อมูลงาน
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-4">
      <input type="hidden" name="job_id" value={job.id} />
      <label className="block text-sm">
        อาการเสีย
        <textarea name="issue_description" defaultValue={job.issue_description} rows={2} className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          สถานะประกัน
          <select name="warranty" defaultValue={job.warranty} className={input}>
            {Object.entries(WARRANTY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          ช่างผู้รับผิดชอบ
          <select name="technician_id" defaultValue={job.technician_id ?? ""} className={input}>
            <option value="">— ยังไม่ระบุ —</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        อุปกรณ์ที่ฝาก (คั่นด้วย ,)
        <input name="accessories" defaultValue={job.accessories.join(", ")} className={input} />
      </label>
      <label className="block text-sm">
        เอกสารที่มากับสินค้า (คั่นด้วย ,)
        <input name="received_documents" defaultValue={job.received_documents.join(", ")} className={input} />
      </label>
      <label className="block text-sm">
        หมายเหตุ / สภาพเครื่อง
        <textarea name="repair_notes" defaultValue={job.repair_notes ?? ""} rows={2} className={input} />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:underline">
          ยกเลิก
        </button>
        <Msg state={state} />
      </div>
    </form>
  );
}

// ======================= อะไหล่ & ค่าใช้จ่าย =======================
export type Part = {
  id: string;
  part_name: string;
  part_code: string | null;
  quantity: number;
  unit_price: number;
};

export function CostPanel({
  jobId,
  parts,
  laborCost,
  quotationPrice,
  canEdit,
}: {
  jobId: string;
  parts: Part[];
  laborCost: number;
  quotationPrice: number | null;
  canEdit: boolean;
}) {
  const partsTotal = parts.reduce((s, p) => s + Number(p.quantity) * Number(p.unit_price), 0);
  const grand = partsTotal + Number(laborCost);
  const quote = quotationPrice === null ? null : Number(quotationPrice);
  const diff = quote === null ? 0 : grand - quote;

  const [partState, partAction, partPending] = useActionState<ActionResult, FormData>(addPart, {});
  const [costState, costAction, costPending] = useActionState<ActionResult, FormData>(updateCosts, {});
  const [delPending, startDel] = useTransition();
  const [delError, setDelError] = useState<string | null>(null);
  const partForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (partState.ok) partForm.current?.reset();
  }, [partState]);

  const submitPart = useFormSubmit(partAction);
  const submitCost = useFormSubmit(costAction);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr className="border-b border-zinc-200">
              <th className="py-2 font-medium">อะไหล่</th>
              <th className="py-2 text-right font-medium">จำนวน</th>
              <th className="py-2 text-right font-medium">ราคา/หน่วย</th>
              <th className="py-2 text-right font-medium">รวม</th>
              {canEdit && <th className="w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {parts.map((p) => (
              <tr key={p.id}>
                <td className="py-2">
                  {p.part_name}
                  {p.part_code && <span className="ml-2 font-mono text-xs text-zinc-500">{p.part_code}</span>}
                </td>
                <td className="py-2 text-right">{Number(p.quantity)}</td>
                <td className="py-2 text-right">{formatMoney(p.unit_price)}</td>
                <td className="py-2 text-right">{formatMoney(Number(p.quantity) * Number(p.unit_price))}</td>
                {canEdit && (
                  <td className="py-2 text-right">
                    <button
                      disabled={delPending}
                      title="ลบ"
                      onClick={() => {
                        if (!confirm(`ลบ ${p.part_name}?`)) return;
                        startDel(async () => {
                          const r = await deletePart(jobId, p.id);
                          setDelError(r.error ?? null);
                        });
                      }}
                      className="text-zinc-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {parts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-zinc-400">
                  ยังไม่มีรายการอะไหล่
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {delError && <p className="mt-1 text-sm text-rose-600">{delError}</p>}
      </div>

      {canEdit && (
        <form ref={partForm} onSubmit={submitPart} className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-[2fr_1fr_80px_1fr_auto]">
          <input type="hidden" name="job_id" value={jobId} />
          <input name="part_name" placeholder="ชื่ออะไหล่" className={`${input} col-span-2 mt-0 sm:col-span-1`} />
          <input name="part_code" placeholder="รหัส (ถ้ามี)" className={`${input} mt-0`} />
          <input name="quantity" type="number" step="any" min="0" defaultValue="1" className={`${input} mt-0`} />
          <input name="unit_price" type="number" step="any" min="0" placeholder="ราคา/หน่วย" className={`${input} mt-0`} />
          <button disabled={partPending} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            + เพิ่ม
          </button>
          {partState.error && <p className="col-span-full text-sm text-rose-600">{partState.error}</p>}
        </form>
      )}

      <dl className="space-y-1 border-t border-zinc-200 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-500">ค่าอะไหล่</dt>
          <dd>{formatMoney(partsTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">ค่าแรง/ค่าบริการ</dt>
          <dd>{formatMoney(laborCost)}</dd>
        </div>
        <div className="flex justify-between text-base font-bold">
          <dt>รวมทั้งสิ้น</dt>
          <dd>฿ {formatMoney(grand)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">ราคาประเมินที่แจ้งลูกค้า</dt>
          <dd>{quote === null ? "ยังไม่แจ้ง" : `฿ ${formatMoney(quote)}`}</dd>
        </div>
        {quote !== null && Math.abs(diff) > 0.009 && (
          <p className={`text-right text-xs ${diff > 0 ? "text-amber-700" : "text-zinc-500"}`}>
            {diff > 0 ? `⚠ เกินราคาประเมิน ${formatMoney(diff)} บาท` : `ต่ำกว่าราคาประเมิน ${formatMoney(-diff)} บาท`}
          </p>
        )}
      </dl>

      {canEdit && (
        <form onSubmit={submitCost} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="job_id" value={jobId} />
          <label className="text-sm">
            ราคาประเมิน (บาท)
            <input
              name="quotation_price"
              type="number"
              step="any"
              min="0"
              defaultValue={quote ?? ""}
              placeholder="ว่าง = ยังไม่แจ้ง"
              className={input}
            />
          </label>
          <label className="text-sm">
            ค่าแรง/ค่าบริการ (บาท)
            <input name="labor_cost" type="number" step="any" min="0" defaultValue={Number(laborCost)} className={input} />
          </label>
          <button disabled={costPending} className="col-span-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-1">
            {costPending ? "..." : "บันทึกราคา"}
          </button>
          <div className="col-span-full">
            <Msg state={costState} />
          </div>
        </form>
      )}
    </div>
  );
}

// ======================= โน้ต =======================
export function NoteForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(addNote, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const onSubmit = useFormSubmit(action);

  return (
    <form ref={ref} onSubmit={onSubmit} className="flex gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <textarea
        name="body"
        rows={2}
        placeholder="บันทึกการซ่อม / การคุยกับลูกค้า..."
        className={`${input} mt-0 flex-1`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex flex-col justify-end gap-1">
        <button disabled={pending} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "..." : "บันทึก"}
        </button>
      </div>
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
    </form>
  );
}
