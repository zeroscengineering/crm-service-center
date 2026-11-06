"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkChatCustomer, sendChat } from "./actions";
import { searchCustomers } from "../jobs/new/actions";
import { formatPhone } from "@/lib/format";
import type { CustomerWithTools } from "@/lib/types";

export type ChatMsg = {
  id: string;
  direction: "in" | "out";
  msg_type: string;
  text: string | null;
  status: string;
  error: string | null;
  created_at: string;
  has_image: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  video: "🎬 วิดีโอ (เปิดดูใน LINE OA Manager)",
  audio: "🎤 ข้อความเสียง (เปิดฟังใน LINE OA Manager)",
  file: "📎 ไฟล์",
  location: "📍 ตำแหน่ง",
  sticker: "😊 สติกเกอร์",
};

function time(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

/** รีเฟรชข้อมูลจากเซิร์ฟเวอร์ทุก ๆ N วินาที (ข้อความใหม่จะขึ้นเอง) */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function Conversation({
  lineUserId,
  messages,
  canReply,
  mode,
}: {
  lineUserId: string;
  messages: ChatMsg[];
  canReply: boolean;
  mode: "mock" | "live" | null;
}) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  function send() {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      const r = await sendChat(lineUserId, body);
      if (r.error) setNote({ ok: false, text: r.error });
      else {
        setText("");
        setNote(r.info ? { ok: true, text: r.info } : null);
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#8cabd9]/15 p-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">ยังไม่มีข้อความ</p>}
        {messages.map((m) => {
          const mine = m.direction === "out";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    mine ? "rounded-br-sm bg-[#06C755] text-white" : "rounded-bl-sm bg-white text-zinc-800"
                  } ${m.status === "failed" ? "bg-rose-100 text-rose-800" : ""} ${m.status === "mock" ? "bg-amber-100 text-amber-900" : ""}`}
                >
                  {m.msg_type === "image" ? (
                    m.has_image ? (
                      <a href={`/api/chat/image/${m.id}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/chat/image/${m.id}`} alt="รูปจากลูกค้า" className="max-h-60 rounded-lg" loading="lazy" />
                      </a>
                    ) : (
                      "📷 รูปภาพ"
                    )
                  ) : m.msg_type === "text" ? (
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  ) : (
                    <p>
                      {TYPE_LABEL[m.msg_type] ?? `[${m.msg_type}]`}
                      {m.text ? ` ${m.text}` : ""}
                    </p>
                  )}
                </div>
                <span className="mt-0.5 px-1 text-[10px] text-zinc-500">
                  {time(m.created_at)}
                  {m.status === "mock" && " · จำลอง (ไม่ได้ส่งจริง)"}
                  {m.status === "failed" && ` · ส่งไม่สำเร็จ ${m.error ?? ""}`}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {canReply ? (
        <div className="border-t border-zinc-200 bg-white p-3">
          {note && <p className={`mb-2 text-xs ${note.ok ? "text-amber-700" : "text-rose-600"}`}>{note.text}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder="พิมพ์ข้อความ… (Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่)"
              className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20"
            />
            <button
              onClick={send}
              disabled={pending || !text.trim()}
              className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-semibold text-white hover:bg-[#05b34c] disabled:opacity-50"
            >
              {pending ? "..." : "ส่ง"}
            </button>
          </div>
          {mode === "mock" && <p className="mt-1 text-[11px] text-amber-700">โหมดจำลอง: ข้อความจะยังไม่ถึงลูกค้า (เปลี่ยนเป็นส่งจริงในหน้าตั้งค่า)</p>}
        </div>
      ) : (
        <p className="border-t border-zinc-200 bg-white p-3 text-center text-xs text-zinc-500">
          {mode === null ? "ยังไม่ได้ตั้งค่า LINE" : "เฉพาะแอดมินเท่านั้นที่ตอบแชทได้"}
        </p>
      )}
    </div>
  );
}

export function LinkCustomer({
  lineUserId,
  current,
}: {
  lineUserId: string;
  current: { id: string; name: string; phone: string } | null;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerWithTools[]>([]);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => setResults(await searchCustomers(q).catch(() => [])), 300);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-brand hover:underline">
        {current ? "เปลี่ยนลูกค้าที่ผูก" : "ผูกกับลูกค้าในระบบ"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาชื่อ / เบอร์โทร"
        className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
      />
      <ul className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 empty:hidden">
        {results.map((c) => (
          <li key={c.id}>
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await linkChatCustomer(lineUserId, c.id);
                  setOpen(false);
                  setQ("");
                })
              }
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50"
            >
              {c.name} <span className="text-xs text-zinc-500">{formatPhone(c.phone)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-3 text-xs">
        {current && (
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await linkChatCustomer(lineUserId, null);
                setOpen(false);
              })
            }
            className="text-rose-600 hover:underline"
          >
            ยกเลิกการผูก
          </button>
        )}
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:underline">
          ปิด
        </button>
        <Link href="/jobs/new" className="ml-auto text-brand hover:underline">
          + ลูกค้าใหม่ (รับแจ้งซ่อม)
        </Link>
      </div>
    </div>
  );
}
