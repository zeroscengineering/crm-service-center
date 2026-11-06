"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignJobToChat, createCustomerFromChat, linkChatCustomer, searchAssignableJobs, sendChat, type AssignableJob } from "./actions";
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
  video: "วิดีโอ (เปิดดูใน LINE OA Manager)",
  audio: "ข้อความเสียง (เปิดฟังใน LINE OA Manager)",
  file: "ไฟล์",
  location: "ตำแหน่ง",
  sticker: "สติกเกอร์",
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
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-steel/60 p-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">ยังไม่มีข้อความ</p>}
        {messages.map((m) => {
          const mine = m.direction === "out";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    !mine
                      ? "rounded-bl-sm border border-line bg-white text-ink"
                      : m.status === "failed"
                        ? "rounded-br-sm border border-rose-200 bg-rose-50 text-rose-800"
                        : m.status === "mock"
                          ? "rounded-br-sm border border-dashed border-[#b07b00]/50 bg-[#fff6d6] text-[#5c4300]"
                          : "rounded-br-sm bg-[#06C755] text-white"
                  }`}
                >
                  {m.msg_type === "image" ? (
                    m.has_image ? (
                      <a href={`/api/chat/image/${m.id}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/chat/image/${m.id}`} alt="รูปจากลูกค้า" className="max-h-60 rounded-lg" loading="lazy" />
                      </a>
                    ) : (
                      "รูปภาพ"
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
                <span className="mt-0.5 px-1 text-[10px] text-muted">
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
        <div className="border-t border-line bg-white p-3">
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
              className="flex-1 resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20"
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
        <p className="border-t border-line bg-white p-3 text-center text-xs text-muted">
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
        {current ? "เปลี่ยนลูกค้าที่ผูก" : "หรือผูกกับลูกค้าที่มีอยู่แล้ว"}
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
        className="w-full rounded-lg border border-line px-3 py-1.5 text-sm"
      />
      {q.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-muted">ไม่พบลูกค้าชื่อนี้ในระบบ ตั้งเป็นลูกค้าใหม่ได้จากช่องด้านบน</p>
      )}
      <ul className="max-h-48 overflow-y-auto rounded-lg border border-line empty:hidden">
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
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-steel/50"
            >
              {c.name} <span className="text-xs text-muted">{formatPhone(c.phone)}</span>
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
        <button onClick={() => setOpen(false)} className="text-muted hover:underline">
          ปิด
        </button>
      </div>
    </div>
  );
}

/** คนที่ทักมายังไม่ใช่ลูกค้า → ตั้งเป็นลูกค้าได้ทันทีจากหน้าแชท */
export function NewCustomerFromChat({ lineUserId, defaultName }: { lineUserId: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const field = "w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-graphite";

  return (
    <form
      className="space-y-2 rounded-lg border border-line bg-steel/40 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createCustomerFromChat(lineUserId, { name, phone, company_name: company });
          if (r.error) setError(r.error);
          else {
            setError(null);
            router.refresh();
          }
        });
      }}
    >
      <p className="text-sm font-medium">ตั้งเป็นลูกค้าใหม่</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อลูกค้า" className={field} required />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เบอร์โทร (ใส่ทีหลังได้)" inputMode="tel" className={field} />
      <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="ชื่อบริษัท / ร้าน (ถ้ามี)" className={field} />
      <button disabled={pending || !name.trim()} className="w-full rounded-lg bg-graphite px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "กำลังบันทึก" : "บันทึกเป็นลูกค้า"}
      </button>
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <p className="text-[11px] text-muted">บันทึกแล้วจะผูกกับแชทนี้ทันที แก้ข้อมูลเพิ่ม เขียนโน้ต และบันทึกการส่งของได้ต่อเลย</p>
    </form>
  );
}

/** เลือกดีล (งานซ่อม) ที่สร้างไว้แล้ว มาเป็นของแชทนี้ */
export function AssignExistingJob({ lineUserId, customerId }: { lineUserId: string; customerId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AssignableJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      setResults(await searchAssignableJobs(q, customerId).catch(() => []));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, customerId]);

  if (!open) {
    return (
      <div className="space-y-1">
        <button onClick={() => setOpen(true)} className="text-xs font-medium text-brand hover:underline">
          + เลือกดีลที่สร้างไว้แล้ว
        </button>
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.t}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-steel/40 p-2">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="เลขที่เอกสาร SV... / ชื่อลูกค้า / เบอร์"
        className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
      />
      <ul className="max-h-60 space-y-1 overflow-y-auto">
        {results.map((j) => (
          <li key={j.id}>
            <button
              disabled={pending}
              onClick={() => {
                if (!confirm(`ย้ายงาน ${j.doc_no} (ของ ${j.customer_name}) มาเป็นของแชทนี้?\nแจ้งเตือนสถานะงานนี้จะส่งเข้า LINE คนนี้`)) return;
                start(async () => {
                  const r = await assignJobToChat(lineUserId, j.id);
                  setMsg(r.error ? { ok: false, t: r.error } : { ok: true, t: r.info ?? "เรียบร้อย" });
                  if (!r.error) {
                    setOpen(false);
                    setQ("");
                    router.refresh();
                  }
                });
              }}
              className="w-full rounded-md bg-white px-2 py-1.5 text-left text-sm ring-1 ring-line hover:ring-graphite/40 disabled:opacity-60"
            >
              <span className="font-mono text-xs font-semibold">{j.doc_no}</span>
              <span className="block truncate text-xs text-muted">
                {j.customer_name}
                {j.tool ? ` · ${j.tool}` : ""}
              </span>
            </button>
          </li>
        ))}
        {!loading && results.length === 0 && <li className="px-1 text-xs text-muted">ไม่พบงานซ่อม</li>}
        {loading && <li className="px-1 text-xs text-muted">กำลังค้นหา</li>}
      </ul>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">กดเลือกเพื่อย้ายงานมาที่แชทนี้</span>
        <button onClick={() => setOpen(false)} className="text-muted hover:underline">
          ปิด
        </button>
      </div>
      {msg && !msg.ok && <p className="text-xs text-rose-700">{msg.t}</p>}
    </div>
  );
}
