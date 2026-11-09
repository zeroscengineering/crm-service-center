"use client";

import { useState, useTransition } from "react";
import QuoteFooterFields from "@/components/QuoteFooterFields";
import type { QuoteFooter } from "@/lib/quote";
import { saveQuoteDefaults } from "../quotes/actions";

/** ค่าเริ่มต้นของใบเสนอราคาใหม่: เงื่อนไข + ส่วนท้ายเอกสาร */
export default function QuoteDefaultsForm({ footer, terms }: { footer: QuoteFooter; terms: string }) {
  const [f, setF] = useState(footer);
  const [t, setT] = useState(terms);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="field-label">เงื่อนไขเริ่มต้น (หนึ่งบรรทัดต่อหนึ่งข้อ)</span>
        <textarea rows={4} value={t} onChange={(e) => setT(e.target.value)} className="field" />
      </label>
      <QuoteFooterFields value={f} onChange={setF} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveQuoteDefaults({ footer: f, terms: t });
              setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "บันทึกแล้ว ใช้กับใบเสนอราคาที่สร้างใหม่" });
            })
          }
          className="btn btn-primary"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกค่าเริ่มต้น"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
      </div>
      <p className="text-xs text-muted">ใบเสนอราคาที่สร้างไว้แล้วจะใช้ค่าที่บันทึกในใบนั้น แก้ทีละใบได้ที่หน้าแก้ไขใบเสนอราคา</p>
    </div>
  );
}
