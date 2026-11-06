"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Pencil, Tag as TagIcon, Trash2, X } from "lucide-react";
import { renameCustomer, addCustomerNote, createCustomerTag, deleteCustomerNote, toggleCustomerTag, type SaveState } from "./actions";

export type Tag = { id: string; name: string; color: string };

export function CopyValue({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <code className="truncate rounded bg-steel px-1.5 py-0.5 font-mono text-xs">{value}</code>
      <button
        type="button"
        title="คัดลอก"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="btn btn-ghost btn-sm px-1"
      >
        {done ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      </button>
    </span>
  );
}

export function CustomerTagPicker({ customerId, allTags, selected }: { customerId: string; allTags: Tag[]; selected: string[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const chosen = allTags.filter((t) => selected.includes(t.id));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={box} className="relative flex flex-wrap items-center gap-1.5">
      {chosen.map((t) => (
        <span key={t.id} className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: t.color }}>
          {t.name}
        </span>
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-muted hover:bg-steel"
      >
        <TagIcon size={12} /> {chosen.length ? "แก้แท็ก" : "เพิ่มแท็ก"}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-[10px] border border-line bg-white p-2 shadow-[0_8px_24px_rgba(31,35,40,0.12)]">
          <ul className="max-h-56 overflow-y-auto">
            {allTags.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-steel/60">
                  <input
                    type="checkbox"
                    disabled={pending}
                    checked={selected.includes(t.id)}
                    onChange={(e) => start(async () => void (await toggleCustomerTag(customerId, t.id, e.target.checked)))}
                  />
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: t.color }}>
                    {t.name}
                  </span>
                </label>
              </li>
            ))}
            {allTags.length === 0 && <li className="px-2 py-1 text-xs text-muted">ยังไม่มีแท็ก</li>}
          </ul>
          <form
            className="mt-2 flex gap-1 border-t border-line pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createCustomerTag(customerId, name);
                if (r.error) setErr(r.error);
                else {
                  setName("");
                  setErr(null);
                }
              });
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="สร้างแท็กใหม่" className="field flex-1 py-1" />
            <button disabled={pending || !name.trim()} className="btn btn-dark btn-sm">
              สร้าง
            </button>
          </form>
          {err && <p className="mt-1 text-xs text-rose-700">{err}</p>}
          <p className="mt-1 px-1 text-[11px] text-muted">ใช้รายการแท็กเดียวกับหน้าแชท</p>
        </div>
      )}
    </div>
  );
}

export function CustomerNoteForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(addCustomerNote, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-2"
    >
      <input type="hidden" name="customer_id" value={customerId} />
      <textarea
        name="body"
        rows={2}
        placeholder="โน้ตภายใน (ลูกค้าไม่เห็น) เช่น ชอบให้โทรก่อนส่ง, เครดิต 30 วัน"
        className="field"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-dark btn-sm">
          {pending ? "กำลังบันทึก..." : "บันทึกโน้ต"}
        </button>
        {state.error && <span className="text-xs text-rose-700">{state.error}</span>}
      </div>
    </form>
  );
}

export function DeleteNoteButton({ customerId, noteId }: { customerId: string; noteId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      title="ลบโน้ต"
      onClick={() => {
        if (confirm("ลบโน้ตนี้?")) start(async () => void (await deleteCustomerNote(customerId, noteId)));
      }}
      className="btn btn-ghost btn-sm px-1 text-muted hover:text-rose-700"
    >
      <Trash2 size={13} />
    </button>
  );
}

/** ชื่อลูกค้าที่หัวโปรไฟล์ กดดินสอเพื่อแก้ชื่อ */
export function EditableName({ customerId, name }: { customerId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (value.trim() === name) return setEditing(false);
    start(async () => {
      const r = await renameCustomer(customerId, value);
      if (r.error) setError(r.error);
      else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-2">
        <h1 className="break-words text-[26px] font-semibold leading-tight tracking-tight">{name}</h1>
        <button
          type="button"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          className="btn btn-ghost btn-sm shrink-0 text-muted"
          title="แก้ไขชื่อลูกค้า"
        >
          <Pencil size={14} /> แก้ชื่อ
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          className="field max-w-md text-lg font-semibold"
          value={value}
          maxLength={120}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button type="button" onClick={save} disabled={pending} className="btn btn-dark btn-sm">
          <Check size={14} /> {pending ? "กำลังบันทึก" : "บันทึก"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
          <X size={14} /> ยกเลิก
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-brand">{error}</p>}
    </div>
  );
}
