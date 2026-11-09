import { adminConfigured } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { DEFAULT_COMPANY, DEFAULT_TERMS, mergeFooter, type Company, type QuoteFooter } from "@/lib/quote";

/** ข้อมูลบริษัทบนหัวเอกสาร (แก้ได้ในหน้าตั้งค่า) */
export async function getCompany(): Promise<Company> {
  if (!adminConfigured()) return DEFAULT_COMPANY;
  const saved = await getSetting<Partial<Company>>("company").catch(() => null);
  return { ...DEFAULT_COMPANY, ...(saved ?? {}) };
}

export type QuoteDefaults = { footer: QuoteFooter; terms: string };

/** ค่าเริ่มต้นของใบเสนอราคาใหม่ (ส่วนท้าย + เงื่อนไข) — แก้ได้ในหน้าตั้งค่า */
export async function getQuoteDefaults(): Promise<QuoteDefaults> {
  if (!adminConfigured()) return { footer: mergeFooter(), terms: DEFAULT_TERMS };
  const saved = await getSetting<{ footer?: Partial<QuoteFooter>; terms?: string }>("quote_defaults").catch(() => null);
  return { footer: mergeFooter(saved?.footer), terms: saved?.terms?.trim() ? saved.terms : DEFAULT_TERMS };
}
