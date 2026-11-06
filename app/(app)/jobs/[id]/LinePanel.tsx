"use client";

import { useState, useTransition } from "react";
import { sendLineMessage } from "../actions";
import { formatDateTime } from "@/lib/format";

export type LineLog = {
  id: string;
  message: string;
  mode: "mock" | "live";
  success: boolean;
  error: string | null;
  created_at: string;
};

export default function LinePanel({
  jobId,
  defaultText,
  linked,
  mode,
  configured,
  canEdit,
  logs,
}: {
  jobId: string;
  defaultText: string;
  linked: boolean;
  mode: "mock" | "live";
  configured: boolean;
  canEdit: boolean;
  logs: LineLog[];
}) {
  const [text, setText] = useState(defaultText);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 ring-1 ${linked ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-steel text-muted ring-zinc-200"}`}>
          {linked ? "ลูกค้าเชื่อม LINE แล้ว" : "ลูกค้ายังไม่เชื่อม LINE"}
        </span>
        <span className={`rounded-full px-2.5 py-1 ring-1 ${mode === "live" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
          {mode === "live" ? "โหมดส่งจริง" : "โหมดจำลอง"}
        </span>
        {!configured && <span className="rounded-full bg-steel px-2.5 py-1 text-muted ring-1 ring-zinc-200">ยังไม่ได้ตั้งค่า LINE</span>}
      </div>
      {!linked && (
        <p className="text-xs text-muted">ให้ลูกค้าแอด LINE OA (QR บนใบรับเครื่อง) แล้วพิมพ์เลขที่เอกสาร ระบบจะเชื่อมให้อัตโนมัติ</p>
      )}

      {canEdit && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setMsg(null);
                  const r = await sendLineMessage(jobId, text);
                  setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: r.info ?? "สำเร็จ" });
                })
              }
              className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-semibold text-white hover:bg-[#05b34c] disabled:opacity-60"
            >
              {pending ? "กำลังส่ง..." : mode === "live" ? "ส่ง LINE ถึงลูกค้า" : "ทดลองส่ง (จำลอง)"}
            </button>
            <button type="button" onClick={() => setText(defaultText)} className="text-sm text-muted hover:underline">
              ใช้ข้อความตามสถานะปัจจุบัน
            </button>
            {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</span>}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">ประวัติข้อความ ({logs.length})</p>
        <ul className="space-y-2">
          {logs.map((l) => (
            <li key={l.id} className="rounded-lg bg-steel/50 px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap">{l.message}</p>
              <p className={`mt-1 text-xs ${l.success ? "text-zinc-400" : "text-rose-600"}`}>
                {formatDateTime(l.created_at)} · {l.mode === "live" ? "ส่งจริง" : "จำลอง"}
                {l.success ? " " : ` ${l.error ?? ""}`}
              </p>
            </li>
          ))}
          {logs.length === 0 && <li className="text-xs text-zinc-400">ยังไม่มีข้อความ</li>}
        </ul>
      </div>
    </div>
  );
}
