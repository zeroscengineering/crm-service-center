"use client";

import type { QuoteFooter } from "@/lib/quote";

/** ช่องแก้ "ส่วนท้ายเอกสาร" ใบเสนอราคา — ใช้ทั้งหน้าแก้ไขใบเสนอราคาและหน้าตั้งค่า (ค่าเริ่มต้น) */
export default function QuoteFooterFields({
  value,
  onChange,
  disabled,
}: {
  value: QuoteFooter;
  onChange: (v: QuoteFooter) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof QuoteFooter>(k: K, v: QuoteFooter[K]) => onChange({ ...value, [k]: v });
  const side = (p: "left" | "right", title: string) => (
    <div className="space-y-2 rounded-md border border-line p-3">
      <p className="text-xs font-semibold text-muted">{title}</p>
      <label className="block">
        <span className="field-label">หัวข้อใต้เส้นลงชื่อ</span>
        <input
          disabled={disabled}
          value={value[`${p}_label`]}
          onChange={(e) => set(`${p}_label`, e.target.value)}
          placeholder={p === "left" ? "เช่น ผู้เสนอราคา" : "เช่น ผู้อนุมัติสั่งซ่อม (ลูกค้า)"}
          className="field"
        />
      </label>
      <label className="block">
        <span className="field-label">ชื่อ (แสดงในวงเล็บ)</span>
        <input
          disabled={disabled}
          value={value[`${p}_name`]}
          onChange={(e) => set(`${p}_name`, e.target.value)}
          placeholder="เว้นว่าง = ไม่แสดง"
          className="field"
        />
      </label>
      <label className="block">
        <span className="field-label">ตำแหน่ง</span>
        <input
          disabled={disabled}
          value={value[`${p}_position`]}
          onChange={(e) => set(`${p}_position`, e.target.value)}
          placeholder="เช่น ผู้จัดการศูนย์บริการ"
          className="field"
        />
      </label>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {side("left", "ช่องลงนามซ้าย (ฝั่งบริษัท)")}
        {side("right", "ช่องลงนามขวา (ฝั่งลูกค้า)")}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={disabled} checked={value.show_date} onChange={(e) => set("show_date", e.target.checked)} />
        แสดงบรรทัด "วันที่ ..../..../...." ใต้ช่องลงนาม
      </label>
      <label className="block">
        <span className="field-label">ข้อความท้ายเอกสาร (เช่น บัญชีธนาคารสำหรับโอนเงิน, ขอบคุณที่ใช้บริการ)</span>
        <textarea
          disabled={disabled}
          rows={3}
          value={value.footer_text}
          onChange={(e) => set("footer_text", e.target.value)}
          className="field"
        />
      </label>
      <p className="text-[11px] text-muted">ล้างหัวข้อ ชื่อ และตำแหน่งของฝั่งไหนทั้งหมด = ไม่แสดงช่องลงนามฝั่งนั้น</p>
    </div>
  );
}
