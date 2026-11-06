"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Palette, Tag as TagIcon, X } from "lucide-react";
import TagColorPicker from "@/components/TagColorPicker";
import { TAG_PALETTE } from "@/lib/tag-colors";
import { createTag, deleteTag, toggleContactTag, updateTagColor } from "./actions";

export type Tag = { id: string; name: string; color: string };

export function TagChip({ tag, small }: { tag: Tag; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-white ${small ? "px-1.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
    </span>
  );
}

export default function TagPicker({
  lineUserId,
  allTags,
  selected,
  canEdit,
}: {
  lineUserId: string;
  allTags: Tag[];
  selected: string[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_PALETTE[allTags.length % TAG_PALETTE.length]);
  const [recolor, setRecolor] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
    <div ref={box} className="relative flex flex-wrap items-center gap-1">
      {chosen.map((t) => (
        <TagChip key={t.id} tag={t} />
      ))}
      {canEdit && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-muted hover:bg-steel/50"
        >
          <TagIcon size={12} className="inline" /> {chosen.length ? "แก้แท็ก" : "เพิ่มแท็ก"}
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 panel p-2 shadow-lg">
          <ul className="max-h-56 overflow-y-auto">
            {allTags.map((t) => {
              const on = selected.includes(t.id);
              return (
                <li key={t.id} className="rounded-md hover:bg-steel/50">
                <div className="group flex items-center gap-2 px-2 py-1">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={pending}
                      onChange={(e) => start(async () => void (await toggleContactTag(lineUserId, t.id, e.target.checked)))}
                    />
                    <TagChip tag={t} />
                  </label>
                  <button
                    type="button"
                    title="เปลี่ยนสีแท็ก"
                    onClick={() => setRecolor((r) => (r === t.id ? null : t.id))}
                    className={`text-zinc-400 hover:text-ink ${recolor === t.id ? "block text-ink" : "hidden group-hover:block"}`}
                  >
                    <Palette size={14} />
                  </button>
                  <button
                    title="ลบแท็กนี้ออกจากระบบ"
                    onClick={() => {
                      if (confirm(`ลบแท็ก “${t.name}” ออกจากทุกแชท?`)) start(async () => void (await deleteTag(t.id)));
                    }}
                    className="hidden text-xs text-zinc-400 hover:text-rose-600 group-hover:block"
                  >
                    <X size={14} />
                  </button>
                </div>
                {recolor === t.id && (
                  <div className="px-2 pb-2">
                    <TagColorPicker
                      value={t.color}
                      disabled={pending}
                      onChange={(c) => start(async () => void (await updateTagColor(t.id, c)))}
                    />
                  </div>
                )}
                </li>
              );
            })}
            {allTags.length === 0 && <li className="px-2 py-1 text-xs text-zinc-400">ยังไม่มีแท็ก</li>}
          </ul>
          <form
            className="mt-2 space-y-2 border-t border-line pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createTag(name, lineUserId, color);
                if (r.error) setError(r.error);
                else {
                  setName("");
                  setError(null);
                  setColor(TAG_PALETTE[(TAG_PALETTE.indexOf(color as (typeof TAG_PALETTE)[number]) + 1) % TAG_PALETTE.length]);
                }
              });
            }}
          >
            <div className="flex gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="สร้างแท็กใหม่"
                className="min-w-0 flex-1 rounded-md border border-line px-2 py-1 text-sm"
              />
              <button disabled={pending || !name.trim()} className="rounded-md bg-graphite px-2 text-xs text-white disabled:opacity-50">
                สร้าง
              </button>
            </div>
            <TagColorPicker value={color} onChange={setColor} disabled={pending} />
            {name.trim() && <TagChip tag={{ id: "preview", name: name.trim(), color }} />}
          </form>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
