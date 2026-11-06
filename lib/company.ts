import { adminConfigured } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { DEFAULT_COMPANY, type Company } from "@/lib/quote";

/** ข้อมูลบริษัทบนหัวเอกสาร (แก้ได้ในหน้าตั้งค่า) */
export async function getCompany(): Promise<Company> {
  if (!adminConfigured()) return DEFAULT_COMPANY;
  const saved = await getSetting<Partial<Company>>("company").catch(() => null);
  return { ...DEFAULT_COMPANY, ...(saved ?? {}) };
}
