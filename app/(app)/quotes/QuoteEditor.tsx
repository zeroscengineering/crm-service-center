"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { deleteQuote, saveQuote, type QuoteInput } from "./actions";
import TaxLookupButton from "@/components/TaxLookupButton";
import {
  bahtText,
  calcQuote,
  QUOTE_STATUS_LABEL,
  VAT_LABEL,
  type QuoteItem,
  type QuoteStatus,
  type VatMode,
} from "@/lib/quote";
import { formatMoney } from "@/lib/format";

const blankItem = (): QuoteItem => ({ description: "", qty: 1, unit: "ชิ้น", unit_price: 0 });

function L({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default function QuoteEditor({
  initial,
  canEdit,
  jobDocNo,
}: {
  initial: QuoteInput;
  canEdit: boolean;
  jobDocNo?: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState<QuoteInput>({ ...initial, items: initial.items.length ? initial.items : [blankItem()] });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const totals = useMemo(() => calcQuote(q.items, q.discount, q.vat_mode), [q.items, q.discount, q.vat_mode]);

  function set<K extends keyof QuoteInput>(k: K, v: QuoteInput[K]) {
    setQ((s) => ({ ...s, [k]: v }));
    setDirty(true);
  }
  function setItem(i: number, patch: Partial<QuoteItem>) {
    setQ((s) => ({ ...s, items: s.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
    setDirty(true);
  }
  function move(i: number, d: -1 | 1) {
    setQ((s) => {
      const items = [...s.items];
      const j = i + d;
      if (j < 0 || j >= items.length) return s;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...s, items };
    });
    setDirty(true);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveQuote(q);
      if (r.error) return setMsg({ ok: false, text: r.error });
      setDirty(false);
      setMsg({ ok: true, text: "บันทึกแล้ว" });
      if (!q.id && r.id) {
        router.replace(`/quotes/${r.id}`);
      } else router.refresh();
    });
  }

  const ro = !canEdit;

  return (
    <div className="space-y-5">
      {/* แถบคำสั่ง */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-steel/95 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
        {canEdit && (
          <button onClick={save} disabled={pending} className="btn btn-primary">
            <Save size={16} /> {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        )}
        {q.id ? (
          <Link
            href={`/print/quote/${q.id}`}
            target="_blank"
            className={`btn btn-secondary ${dirty ? "pointer-events-none opacity-50" : ""}`}
            title={dirty ? "บันทึกก่อนพิมพ์" : "เปิดหน้าพิมพ์ / บันทึกเป็น PDF"}
          >
            <Printer size={16} /> พิมพ์ / บันทึก PDF
          </Link>
        ) : (
          <span className="text-xs text-muted">บันทึกก่อน จึงจะพิมพ์ได้</span>
        )}
        {dirty && <span className="text-xs font-medium text-[#8a6100]">มีการแก้ไขที่ยังไม่บันทึก</span>}
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
        {canEdit && q.id && (
          <button
            onClick={() => {
              if (!confirm(`ลบใบเสนอราคา ${q.quote_no}?`)) return;
              start(async () => {
                const r = await deleteQuote(q.id!);
                if (r.error) setMsg({ ok: false, text: r.error });
                else router.push("/quotes");
              });
            }}
            className="btn btn-danger ml-auto"
          >
            <Trash2 size={16} /> ลบ
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ลูกค้า */}
        <section className="panel p-5 lg:col-span-2">
          <h2 className="panel-title mb-4">เสนอราคาให้</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="ชื่อลูกค้า / บริษัท" className="sm:col-span-2">
              <input disabled={ro} value={q.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="field" />
            </L>
            <L label="ที่อยู่" className="sm:col-span-2">
              <textarea
                disabled={ro}
                rows={2}
                value={q.customer_address}
                onChange={(e) => set("customer_address", e.target.value)}
                className="field"
              />
            </L>
            <L label="เบอร์โทร">
              <input disabled={ro} value={q.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} className="field" />
            </L>
            <L label="เลขประจำตัวผู้เสียภาษี (ถ้ามี)">
              <input
                disabled={ro}
                value={q.customer_tax_id}
                onChange={(e) => set("customer_tax_id", e.target.value)}
                className="field font-mono"
              />
            </L>
            <L label="สาขา (ถ้ามี)">
              <input
                disabled={ro}
                value={q.customer_branch}
                onChange={(e) => set("customer_branch", e.target.value)}
                placeholder="เช่น สำนักงานใหญ่"
                className="field"
              />
            </L>
            {!ro && (
              <div className="sm:col-span-2">
                <TaxLookupButton
                  getTin={() => q.customer_tax_id}
                  onPick={(info) => {
                    setDirty(true);
                    setQ((s) => ({
                      ...s,
                      customer_tax_id: info.tin,
                      customer_name: info.name || s.customer_name,
                      customer_address: info.address || s.customer_address,
                      customer_branch: info.branch_label,
                    }));
                  }}
                />
              </div>
            )}
            <L label="เรื่อง">
              <input
                disabled={ro}
                value={q.subject}
                onChange={(e) => set("subject", e.target.value)}
                placeholder="เช่น ค่าซ่อม Milwaukee M18 FPD2"
                className="field"
              />
            </L>
          </div>
        </section>

        {/* ข้อมูลเอกสาร */}
        <section className="panel p-5">
          <h2 className="panel-title mb-4">ข้อมูลเอกสาร</h2>
          <div className="space-y-3">
            <L label="เลขที่ใบเสนอราคา">
              <input
                disabled={ro}
                value={q.quote_no}
                onChange={(e) => set("quote_no", e.target.value)}
                className="field font-mono uppercase"
              />
            </L>
            <div className="grid grid-cols-2 gap-3">
              <L label="วันที่">
                <input disabled={ro} type="date" value={q.issue_date} onChange={(e) => set("issue_date", e.target.value)} className="field" />
              </L>
              <L label="ยืนราคา (วัน)">
                <input
                  disabled={ro}
                  type="number"
                  min={0}
                  value={q.valid_days}
                  onChange={(e) => set("valid_days", Number(e.target.value))}
                  className="field"
                />
              </L>
            </div>
            <L label="สถานะ">
              <select disabled={ro} value={q.status} onChange={(e) => set("status", e.target.value as QuoteStatus)} className="field">
                {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {QUOTE_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </L>
            {jobDocNo && q.repair_job_id && (
              <p className="text-sm text-muted">
                อ้างอิงงานซ่อม{" "}
                <Link href={`/jobs/${q.repair_job_id}`} className="doc-tag hover:border-graphite/60">
                  {jobDocNo}
                </Link>
              </p>
            )}
          </div>
        </section>
      </div>

      {/* รายการ */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">รายการ</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>รายละเอียด</th>
                <th className="w-24 text-right">จำนวน</th>
                <th className="w-24">หน่วย</th>
                <th className="w-36 text-right">ราคา/หน่วย</th>
                <th className="w-36 text-right">จำนวนเงิน</th>
                {canEdit && <th className="w-24" />}
              </tr>
            </thead>
            <tbody>
              {q.items.map((it, i) => (
                <tr key={i} className="align-top">
                  <td className="pt-5 text-center font-mono text-xs text-muted">{i + 1}</td>
                  <td>
                    <textarea
                      disabled={ro}
                      rows={1}
                      value={it.description}
                      onChange={(e) => setItem(i, { description: e.target.value })}
                      placeholder="เช่น เปลี่ยนบอร์ดควบคุม"
                      className="field min-h-[38px] resize-y"
                    />
                  </td>
                  <td>
                    <input
                      disabled={ro}
                      type="number"
                      step="any"
                      min={0}
                      value={it.qty}
                      onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                      className="field text-right"
                    />
                  </td>
                  <td>
                    <input disabled={ro} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} className="field" />
                  </td>
                  <td>
                    <input
                      disabled={ro}
                      type="number"
                      step="any"
                      min={0}
                      value={it.unit_price}
                      onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })}
                      className="field text-right"
                    />
                  </td>
                  <td className="pt-5 text-right font-mono tabular-nums">
                    {formatMoney((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                  </td>
                  {canEdit && (
                    <td className="pt-4">
                      <div className="flex justify-end gap-0.5">
                        <button title="เลื่อนขึ้น" onClick={() => move(i, -1)} className="btn btn-ghost btn-sm px-1.5">
                          <ArrowUp size={14} />
                        </button>
                        <button title="เลื่อนลง" onClick={() => move(i, 1)} className="btn btn-ghost btn-sm px-1.5">
                          <ArrowDown size={14} />
                        </button>
                        <button
                          title="ลบรายการ"
                          onClick={() => {
                            setQ((s) => ({ ...s, items: s.items.filter((_, idx) => idx !== i) }));
                            setDirty(true);
                          }}
                          className="btn btn-danger btn-sm px-1.5"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="border-t border-line px-5 py-3">
            <button
              onClick={() => {
                setQ((s) => ({ ...s, items: [...s.items, blankItem()] }));
                setDirty(true);
              }}
              className="btn btn-secondary btn-sm"
            >
              <Plus size={14} /> เพิ่มรายการ
            </button>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="panel space-y-3 p-5 lg:col-span-2">
          <L label="หมายเหตุ">
            <textarea disabled={ro} rows={2} value={q.notes} onChange={(e) => set("notes", e.target.value)} className="field" />
          </L>
          <L label="เงื่อนไข (หนึ่งบรรทัดต่อหนึ่งข้อ)">
            <textarea disabled={ro} rows={4} value={q.terms} onChange={(e) => set("terms", e.target.value)} className="field" />
          </L>
        </section>

        <section className="panel p-5">
          <div className="space-y-3">
            <L label="ภาษีมูลค่าเพิ่ม">
              <select disabled={ro} value={q.vat_mode} onChange={(e) => set("vat_mode", e.target.value as VatMode)} className="field">
                {(Object.keys(VAT_LABEL) as VatMode[]).map((v) => (
                  <option key={v} value={v}>
                    {VAT_LABEL[v]}
                  </option>
                ))}
              </select>
            </L>
            <L label="ส่วนลด (บาท)">
              <input
                disabled={ro}
                type="number"
                step="any"
                min={0}
                value={q.discount}
                onChange={(e) => set("discount", Number(e.target.value))}
                className="field text-right"
              />
            </L>
          </div>
          <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            <Row label="รวมเป็นเงิน" value={totals.itemsTotal} />
            {q.discount > 0 && <Row label="ส่วนลด" value={-q.discount} />}
            {q.vat_mode !== "none" && (
              <>
                <Row label="มูลค่าก่อนภาษี" value={totals.subtotal} />
                <Row label="ภาษีมูลค่าเพิ่ม 7%" value={totals.vat} />
              </>
            )}
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <dt className="font-semibold">จำนวนเงินทั้งสิ้น</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums">{formatMoney(totals.grand)}</dd>
            </div>
            <p className="text-right text-xs text-muted">({bahtText(totals.grand)})</p>
          </dl>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}
