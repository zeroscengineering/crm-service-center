"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Printer, Save, Search, Trash2, X } from "lucide-react";
import {
  jobToItem,
  RETURN_STATUS_LABEL,
  type ReturnableJob,
  type ReturnItem,
  type ReturnStatus,
} from "@/lib/return-note";
import { deleteReturnNote, loadReturnableJobs, saveReturnNote, type ReturnInput } from "./actions";

const blankItem = (): ReturnItem => ({ job_id: null, doc_no: "", description: "", serial_no: "", qty: 1, unit: "เครื่อง", remark: "" });

function L({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default function ReturnEditor({
  initial,
  readyJobs,
  canDelete,
}: {
  initial: ReturnInput;
  /** งานที่ "ซ่อมเสร็จพร้อมส่งคืน" สำหรับกดเพิ่มเร็ว */
  readyJobs: ReturnableJob[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [r, setR] = useState<ReturnInput>({ ...initial, items: initial.items.length ? initial.items : [blankItem()] });
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // ค้นหางานซ่อมอื่น ๆ (เลขที่เอกสาร / ชื่อลูกค้า)
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ReturnableJob[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(async () => setFound(await loadReturnableJobs({ query: q }).catch(() => [])), 250);
    return () => clearTimeout(t);
  }, [q]);

  const set = <K extends keyof ReturnInput>(k: K, v: ReturnInput[K]) => {
    setR((s) => ({ ...s, [k]: v }));
    setDirty(true);
  };
  const setItem = (i: number, patch: Partial<ReturnItem>) => {
    setR((s) => ({ ...s, items: s.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setR((s) => {
      const items = [...s.items];
      const j = i + d;
      if (j < 0 || j >= items.length) return s;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...s, items };
    });
    setDirty(true);
  };

  const inNote = new Set(r.items.map((i) => i.job_id).filter(Boolean));
  function addJob(j: ReturnableJob) {
    if (inNote.has(j.id)) return;
    if (r.customer_id && j.customer_id && r.customer_id !== j.customer_id) {
      if (!confirm(`งาน ${j.doc_no} เป็นของลูกค้าคนอื่น (${j.customer_name}) ใส่ในใบนี้ด้วยหรือไม่?`)) return;
    }
    setR((s) => {
      const items = s.items.filter((it) => it.description.trim() || it.doc_no.trim()); // ตัดแถวว่าง
      const first = !s.customer_name.trim();
      return {
        ...s,
        customer_id: s.customer_id ?? j.customer_id,
        customer_name: first ? j.customer_name : s.customer_name,
        customer_phone: first ? j.customer_phone : s.customer_phone,
        customer_address: first ? j.customer_address : s.customer_address,
        items: [...items, jobToItem(j)],
      };
    });
    setDirty(true);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveReturnNote(r);
      if (res.error) return setMsg({ ok: false, text: res.error });
      setDirty(false);
      setMsg({ ok: true, text: "บันทึกแล้ว" });
      if (!r.id && res.id) router.replace(`/returns/${res.id}`);
      else router.refresh();
    });
  }

  // งานพร้อมส่งคืนของลูกค้าคนเดียวกันขึ้นก่อน
  const ready = [...readyJobs].sort(
    (a, b) => Number(b.customer_id === r.customer_id) - Number(a.customer_id === r.customer_id) || a.doc_no.localeCompare(b.doc_no),
  );

  return (
    <div className="space-y-5">
      {/* แถบคำสั่ง */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-steel/95 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
        <button onClick={save} disabled={pending} className="btn btn-primary">
          <Save size={16} /> {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        {r.id ? (
          <Link
            href={`/print/return/${r.id}`}
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
        {canDelete && r.id && (
          <button
            onClick={() => {
              if (!confirm(`ลบใบส่งคืน ${r.note_no}?`)) return;
              start(async () => {
                const res = await deleteReturnNote(r.id!);
                if (res.error) setMsg({ ok: false, text: res.error });
                else router.push("/returns");
              });
            }}
            className="btn btn-danger ml-auto"
          >
            <Trash2 size={16} /> ลบ
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2">
          <h2 className="panel-title mb-4">ส่งคืนให้</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="ชื่อลูกค้า / บริษัท" className="sm:col-span-2">
              <input value={r.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="field" />
            </L>
            <L label="ที่อยู่" className="sm:col-span-2">
              <textarea rows={2} value={r.customer_address} onChange={(e) => set("customer_address", e.target.value)} className="field" />
            </L>
            <L label="เบอร์โทร">
              <input value={r.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} className="field" />
            </L>
          </div>
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="panel-title">เอกสาร</h2>
          <L label="เลขที่">
            <input value={r.note_no} onChange={(e) => set("note_no", e.target.value)} className="field font-mono" />
          </L>
          <L label="วันที่">
            <input type="date" value={r.issue_date} onChange={(e) => set("issue_date", e.target.value)} className="field" />
          </L>
          <L label="สถานะ">
            <select value={r.status} onChange={(e) => set("status", e.target.value as ReturnStatus)} className="field">
              {(Object.keys(RETURN_STATUS_LABEL) as ReturnStatus[]).map((s) => (
                <option key={s} value={s}>
                  {RETURN_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </L>
        </section>
      </div>

      {/* เลือกงานซ่อม */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">เพิ่มจากงานซ่อม</h2>
            <p className="text-xs text-muted">กดเพิ่ม แล้วระบบใส่รุ่นเครื่อง S/N เลขที่งาน และอุปกรณ์ที่ฝากไว้ให้</p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-sm font-medium">งานที่ซ่อมเสร็จพร้อมส่งคืน ({ready.length})</p>
            {ready.length === 0 ? (
              <p className="text-xs text-muted">ไม่มีงานในสถานะซ่อมเสร็จพร้อมส่งคืน</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ready.map((j) => {
                  const added = inNote.has(j.id);
                  return (
                    <li key={j.id}>
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => addJob(j)}
                        className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                          added ? "border-emerald-200 bg-emerald-50" : "border-line bg-white hover:border-graphite/40"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-mono text-xs font-semibold">{j.doc_no}</span>
                          <span className="block truncate">{j.customer_name}</span>
                          <span className="block truncate text-xs text-muted">{j.description}</span>
                        </span>
                        <span className={`shrink-0 text-xs font-medium ${added ? "text-emerald-700" : "text-brand"}`}>
                          {added ? "อยู่ในใบแล้ว" : "+ เพิ่ม"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">ค้นหางานอื่น</p>
            <div className="relative max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="เลขที่เอกสาร SV... / ชื่อลูกค้า / เบอร์"
                className="field pl-9"
              />
            </div>
            {found.length > 0 && (
              <ul className="mt-2 max-w-md divide-y divide-line rounded-lg border border-line bg-white">
                {found.map((j) => (
                  <li key={j.id}>
                    <button
                      type="button"
                      disabled={inNote.has(j.id)}
                      onClick={() => addJob(j)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-steel/60 disabled:opacity-50"
                    >
                      <span className="font-mono text-xs font-semibold">{j.doc_no}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {j.customer_name} · {j.description}
                      </span>
                      <span className="text-xs text-brand">{inNote.has(j.id) ? "เพิ่มแล้ว" : "+ เพิ่ม"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* รายการ */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">รายการสินค้าที่ส่งคืน</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>รายการ / รุ่น</th>
                <th className="w-40">S/N</th>
                <th className="w-36">เลขที่งานซ่อม</th>
                <th className="w-20 text-right">จำนวน</th>
                <th className="w-24">หน่วย</th>
                <th className="w-56">หมายเหตุ</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {r.items.map((it, i) => (
                <tr key={i} className="align-top">
                  <td className="pt-5 text-center font-mono text-xs text-muted">{i + 1}</td>
                  <td>
                    <textarea
                      rows={1}
                      value={it.description}
                      onChange={(e) => setItem(i, { description: e.target.value })}
                      placeholder="เช่น Milwaukee M18 FID3"
                      className="field min-h-[38px] resize-y"
                    />
                  </td>
                  <td>
                    <input value={it.serial_no} onChange={(e) => setItem(i, { serial_no: e.target.value })} className="field font-mono" />
                  </td>
                  <td>
                    <input value={it.doc_no} onChange={(e) => setItem(i, { doc_no: e.target.value })} className="field font-mono" />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={it.qty}
                      onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                      className="field text-right"
                    />
                  </td>
                  <td>
                    <input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} className="field" />
                  </td>
                  <td>
                    <textarea
                      rows={1}
                      value={it.remark}
                      onChange={(e) => setItem(i, { remark: e.target.value })}
                      className="field min-h-[38px] resize-y"
                    />
                  </td>
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
                          setR((s) => ({ ...s, items: s.items.filter((_, idx) => idx !== i) }));
                          setDirty(true);
                        }}
                        className="btn btn-ghost btn-sm px-1.5 text-rose-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => {
              setR((s) => ({ ...s, items: [...s.items, blankItem()] }));
              setDirty(true);
            }}
            className="btn btn-secondary btn-sm"
          >
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>
      </section>

      <section className="panel p-5">
        <L label="หมายเหตุ (พิมพ์ท้ายเอกสาร)">
          <textarea rows={3} value={r.notes} onChange={(e) => set("notes", e.target.value)} className="field" />
        </L>
      </section>
    </div>
  );
}
