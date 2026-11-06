"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-steel px-3 py-2 text-xs">{text}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs hover:bg-steel"
      >
        {done ? "คัดลอกแล้ว " : "คัดลอก"}
      </button>
    </div>
  );
}

export function BackupButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          const res = await fetch("/api/google/backup", { method: "POST" });
          const json = await res.json().catch(() => ({}));
          setBusy(false);
          setMsg(res.ok ? { ok: true, text: "สำรองข้อมูลเรียบร้อย " } : { ok: false, text: json.error ?? "ไม่สำเร็จ" });
          router.refresh();
        }}
        className="btn btn-dark btn-sm hover:bg-zinc-700 disabled:opacity-60"
      >
        {busy ? "กำลังสำรองข้อมูล..." : "สำรองข้อมูลตอนนี้"}
      </button>
      {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</span>}
    </div>
  );
}

export function DisconnectButton() {
  return (
    <form
      action="/api/google/disconnect"
      method="post"
      onSubmit={(e) => {
        if (!confirm("ยกเลิกการเชื่อมต่อ Google Drive? (ไฟล์ใน Drive ยังอยู่ แต่เว็บจะแสดงรูปไม่ได้จนกว่าจะเชื่อมใหม่)")) {
          e.preventDefault();
        }
      }}
    >
      <button className="rounded-lg border border-rose-300 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50">
        ยกเลิกการเชื่อมต่อ
      </button>
    </form>
  );
}
