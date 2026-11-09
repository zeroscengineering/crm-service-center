/** ใบเสนอราคา: ชนิดข้อมูล การคำนวณ และตัวอักษรจำนวนเงิน (ใช้ได้ทั้ง server และ client) */

export type VatMode = "exclude" | "include" | "none";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

export type QuoteItem = { description: string; qty: number; unit: string; unit_price: number };

export type Company = {
  name: string;
  tax_id: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
};

export const DEFAULT_COMPANY: Company = {
  name: "บริษัท แสงชัยอีควิพเม้นท์ (1984) จำกัด",
  tax_id: "0105559044775",
  branch: "สำนักงานใหญ่",
  address: "88 อาคารเอ ชั้น 2-3 ถนนบรมราชชนนี แขวงฉิมพลี เขตตลิ่งชัน กรุงเทพมหานคร 10170",
  phone: "",
  email: "",
};

/** ส่วนท้ายใบเสนอราคา (ช่องลงนาม 2 ฝั่ง + ข้อความท้ายเอกสาร) */
export type QuoteFooter = {
  left_label: string;
  left_name: string;
  left_position: string;
  right_label: string;
  right_name: string;
  right_position: string;
  show_date: boolean;
  footer_text: string;
};

export const DEFAULT_FOOTER: QuoteFooter = {
  left_label: "ผู้เสนอราคา",
  left_name: "",
  left_position: "",
  right_label: "ผู้อนุมัติสั่งซ่อม (ลูกค้า)",
  right_name: "",
  right_position: "",
  show_date: true,
  footer_text: "",
};

/** รวมค่าที่บันทึกไว้ (อาจขาดบางช่อง) เข้ากับค่าเริ่มต้น */
export function mergeFooter(...parts: (Partial<QuoteFooter> | null | undefined)[]): QuoteFooter {
  const out: QuoteFooter = { ...DEFAULT_FOOTER };
  for (const p of parts) {
    if (!p) continue;
    for (const k of Object.keys(DEFAULT_FOOTER) as (keyof QuoteFooter)[]) {
      const v = p[k];
      if (v === undefined || v === null) continue;
      (out as Record<string, unknown>)[k] = k === "show_date" ? Boolean(v) : String(v);
    }
  }
  return out;
}

export const DEFAULT_TERMS = [
  "ราคานี้รวมค่าแรงและค่าอะไหล่ตามรายการข้างต้น",
  "รับประกันงานซ่อมและอะไหล่ที่เปลี่ยน 90 วัน นับจากวันส่งมอบ",
  "กรุณายืนยันการซ่อมภายในระยะเวลายืนราคา",
].join("\n");

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "ร่าง",
  sent: "ส่งลูกค้าแล้ว",
  accepted: "ลูกค้าอนุมัติ",
  rejected: "ไม่อนุมัติ",
};

export const QUOTE_STATUS_COLOR: Record<QuoteStatus, string> = {
  draft: "bg-steel text-muted ring-line",
  sent: "bg-sky-50 text-sky-800 ring-sky-200",
  accepted: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const VAT_LABEL: Record<VatMode, string> = {
  exclude: "ราคายังไม่รวม VAT (บวกเพิ่ม)",
  include: "ราคารวม VAT แล้ว",
  none: "ไม่คิด VAT",
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcQuote(items: QuoteItem[], discount: number, vatMode: VatMode, vatRate = 7) {
  const itemsTotal = r2(items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0));
  const afterDiscount = r2(Math.max(itemsTotal - (Number(discount) || 0), 0));
  let subtotal = afterDiscount;
  let vat = 0;
  let grand = afterDiscount;
  if (vatMode === "exclude") {
    vat = r2((afterDiscount * vatRate) / 100);
    grand = r2(afterDiscount + vat);
  } else if (vatMode === "include") {
    subtotal = r2((afterDiscount * 100) / (100 + vatRate));
    vat = r2(afterDiscount - subtotal);
  }
  return { itemsTotal, afterDiscount, subtotal, vat, grand };
}

/** แปลงตัวเลขเป็นคำอ่านภาษาไทย เช่น 5350.5 → "ห้าพันสามร้อยห้าสิบบาทห้าสิบสตางค์" */
export function bahtText(amount: number): string {
  const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

  function readInt(n: string): string {
    // อ่านทีละกลุ่ม 6 หลัก (ล้าน)
    if (n.length > 6) {
      const head = n.slice(0, n.length - 6);
      const tail = n.slice(-6);
      return readInt(head) + "ล้าน" + readInt(tail);
    }
    let out = "";
    const len = n.length;
    for (let i = 0; i < len; i++) {
      const d = Number(n[i]);
      const pos = len - i - 1;
      if (d === 0) continue;
      if (pos === 0 && d === 1 && len > 1) out += "เอ็ด";
      else if (pos === 1 && d === 2) out += "ยี่";
      else if (pos === 1 && d === 1) out += "";
      else out += digits[d];
      out += units[pos];
    }
    return out;
  }

  const fixed = Math.abs(Math.round(amount * 100) / 100).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const intText = Number(intPart) === 0 ? "ศูนย์" : readInt(String(Number(intPart)));
  const sat = Number(decPart);
  return `${intText}บาท${sat === 0 ? "ถ้วน" : readInt(String(sat)) + "สตางค์"}`;
}
