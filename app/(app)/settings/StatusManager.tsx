"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import TagColorPicker from "@/components/TagColorPicker";
import { badgeStyle, type StatusDef, type StatusKind } from "@/lib/status-def";
import { deleteStatus, moveStatus, saveStatus } from "./status-actions";

const KIND_LABEL: Record<StatusKind, string> = {
  open: "งานยังไม่ปิด",
  done: "ปิดงาน (สำเร็จ)",
  cancelled: "ยกเลิก",
};

type Draft = { key?: string; label: string; color: string; kind: StatusKind; hidden: boolean; line_message: string };

function Editor({
  draft,
  system,
  onCancel,
  onSaved,
}: {
  draft: Draft;
  system: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState(draft);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-3 rounded-lg border border-line bg-steel/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">ชื่อสถานะ</span>
          <input value={d.label} onChange={(e) => set("label", e.target.value)} placeholder="เช่น รออะไหล่" className="field" autoFocus />
        </label>
        <label className="block">
          <span className="field-label">ประเภท</span>
          <select
            value={d.kind}
            disabled={system}
            onChange={(e) => set("kind", e.target.value as StatusKind)}
            className="field disabled:opacity-60"
          >
            {(Object.keys(KIND_LABEL) as StatusKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          {system && <span className="mt-1 block text-[11px] text-muted">สถานะตั้งต้นของระบบ เปลี่ยนประเภทไม่ได้</span>}
        </label>
      </div>
      <div>
        <span className="field-label">สี</span>
        <div className="flex flex-wrap items-center gap-3">
          <TagColorPicker value={d.color} onChange={(c) => set("color", c)} />
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={badgeStyle(d.color)}>
            {d.label || "ตัวอย่าง"}
          </span>
        </div>
      </div>
      <label className="block">
        <span className="field-label">ข้อความ LINE เมื่อเปลี่ยนเป็นสถานะนี้ (เว้นว่าง = ใช้ข้อความมาตรฐาน)</span>
        <textarea
          rows={3}
          value={d.line_message}
          onChange={(e) => set("line_message", e.target.value)}
          placeholder="เช่น ขณะนี้รออะไหล่จากตัวแทนจำหน่าย คาดว่าจะได้รับภายใน 7 วัน"
          className="field"
        />
        <span className="mt-1 block text-[11px] text-muted">
          ใส่ {"{ราคา}"} {"{ยอดชำระ}"} {"{สถานะ}"} ได้ ระบบจะแทนค่าให้ · หัวข้อความ (ชื่อลูกค้า เลขที่งาน) และลิงก์ติดตามใส่ให้อัตโนมัติ
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveStatus(d);
              if (r.error) setErr(r.error);
              else onSaved();
            })
          }
          className="btn btn-dark btn-sm"
        >
          {pending ? "กำลังบันทึก" : "บันทึก"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          ยกเลิก
        </button>
        {err && <span className="text-xs text-rose-700">{err}</span>}
      </div>
    </div>
  );
}

export default function StatusManager({ statuses, usage }: { statuses: StatusDef[]; usage: Record<string, number> }) {
  const [editing, setEditing] = useState<string | null>(null); // key | "new"
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      setErr(r.error ?? null);
    });

  return (
    <div className="space-y-3">
      <ol className="divide-y divide-line rounded-lg border border-line">
        {statuses.map((s, i) => (
          <li key={s.key} className={s.hidden ? "bg-steel/40" : ""}>
            <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveStatus(s.key, -1))}
                  className="text-zinc-400 hover:text-ink disabled:opacity-30"
                  title="เลื่อนขึ้น"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={pending || i === statuses.length - 1}
                  onClick={() => run(() => moveStatus(s.key, 1))}
                  className="text-zinc-400 hover:text-ink disabled:opacity-30"
                  title="เลื่อนลง"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={badgeStyle(s.color)}>
                {s.label}
              </span>
              <span className="text-xs text-muted">{KIND_LABEL[s.kind]}</span>
              {s.hidden && <span className="text-xs text-muted">· ซ่อนอยู่</span>}
              {s.line_message && <span className="text-xs text-muted">· มีข้อความ LINE</span>}
              <span className="ml-auto text-xs text-muted">{usage[s.key] ?? 0} งาน</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setEditing(s.key)} className="btn btn-ghost btn-sm" title="แก้ไข">
                  <Pencil size={14} />
                </button>
                {s.key !== "received" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        saveStatus({
                          key: s.key,
                          label: s.label,
                          color: s.color,
                          kind: s.kind,
                          hidden: !s.hidden,
                          line_message: s.line_message ?? "",
                        }),
                      )
                    }
                    className="btn btn-ghost btn-sm"
                    title={s.hidden ? "แสดงสถานะนี้" : "ซ่อนจาก Pipeline และเมนูเลือก"}
                  >
                    {s.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
                {!s.is_system && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`ลบสถานะ "${s.label}"?`)) run(() => deleteStatus(s.key));
                    }}
                    className="btn btn-ghost btn-sm text-rose-700"
                    title="ลบ"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            {editing === s.key && (
              <div className="px-3 pb-3">
                <Editor
                  draft={{
                    key: s.key,
                    label: s.label,
                    color: s.color,
                    kind: s.kind,
                    hidden: s.hidden,
                    line_message: s.line_message ?? "",
                  }}
                  system={s.is_system}
                  onCancel={() => setEditing(null)}
                  onSaved={() => setEditing(null)}
                />
              </div>
            )}
          </li>
        ))}
      </ol>

      {err && <p className="text-sm text-rose-700">{err}</p>}

      {editing === "new" ? (
        <Editor
          draft={{ label: "", color: "#7C3AED", kind: "open", hidden: false, line_message: "" }}
          system={false}
          onCancel={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="btn btn-secondary btn-sm">
          <Plus size={14} /> เพิ่มสถานะ
        </button>
      )}

      <p className="text-xs text-muted">
        ลำดับในรายการ = ลำดับคอลัมน์บน Pipeline และขั้นตอนในหน้าติดตามของลูกค้า · สถานะที่ซ่อนจะไม่แสดงบน Pipeline และเมนูเลือก
        แต่งานเดิมยังแสดงชื่อสถานะได้ · ตั้งให้ส่ง LINE อัตโนมัติได้ที่หัวข้อ LINE ด้านล่าง
      </p>
    </div>
  );
}
