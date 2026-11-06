"use client";

import { Check } from "lucide-react";
import { TAG_PALETTE } from "@/lib/tag-colors";

/** แถวเลือกสีแท็ก: สีสำเร็จรูป + เลือกสีเอง */
export default function TagColorPicker({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  const custom = !TAG_PALETTE.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-1">
      {TAG_PALETTE.map((c) => {
        const on = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onChange(c)}
            title={c}
            className={`flex h-5 w-5 items-center justify-center rounded-full ring-offset-1 transition ${on ? "ring-2 ring-graphite" : "hover:scale-110"}`}
            style={{ backgroundColor: c }}
          >
            {on && <Check size={11} className="text-white" strokeWidth={3} />}
          </button>
        );
      })}
      <label
        title="เลือกสีเอง"
        className={`relative flex h-5 w-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-line ring-offset-1 ${custom ? "ring-2 ring-graphite" : ""}`}
        style={{ background: custom ? value : "conic-gradient(#D7261E, #D97706, #16A34A, #0891B2, #7C3AED, #DB2777, #D7261E)" }}
      >
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
