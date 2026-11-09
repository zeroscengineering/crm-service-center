"use client";

import { useState, useTransition } from "react";
import type { QuoteFooter } from "@/lib/quote";
import { saveQuoteDefaults } from "../quotes/actions";

/** ค่าเริ่มต้นของใบเสนอราคาใหม่: เงื่อนไข + ข้อความท้ายเอกสาร */
export default function QuoteDefaultsForm({ footer, terms }: { footer: QuoteFooter; terms: string }) {
  const [text, setText] = useState(footer.footer_text);
  const [t, setT] = useState(terms);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="field-label">เงื่อนไขเริ่มต้น (หนึ่งบรรทัดต่อหนึ่งข้อ)</span>
        <textarea rows={4} value={t} onChange={(e) => setT(e.target.value)} className="field" />
      </label>
      <label className="block">
        <span className="field-label">ข้อความท้ายเอกสาร (เช่น บัญชีธนาคารสำหรับโอนเงิน, ขอบคุณที่ใช้บริการ)</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="field" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveQuoteDefaults({ footer: { ...footer, footer_text: text }, terms: t });
              setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "บันทึกแล้ว ใช้กับใบเสนอราคาที่สร้างใหม่" });
            })
          }
          className="btn btn-primary"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกค่าเริ่มต้น"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
      </div>
      <p className="text-xs text-muted">
        เมื่อบันทึกใบเสนอราคาโดยติ๊ก "จำไว้ใช้กับใบถัดไป" ค่าตรงนี้จะอัปเดตตามใบล่าสุดอัตโนมัติ
      </p>
    </div>
  );
}
