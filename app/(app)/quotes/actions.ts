"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { calcQuote, mergeFooter, type Company, type QuoteFooter, type QuoteItem, type QuoteStatus, type VatMode } from "@/lib/quote";

export type QuoteInput = {
  id?: string;
  quote_no: string;
  repair_job_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_tax_id: string;
  customer_branch: string;
  subject: string;
  issue_date: string;
  valid_days: number;
  status: QuoteStatus;
  discount: number;
  vat_mode: VatMode;
  notes: string;
  terms: string;
  footer: QuoteFooter;
  items: QuoteItem[];
};

export type QuoteResult = { ok?: boolean; error?: string; id?: string; warn?: string };

async function admin() {
  const p = await requireProfile();
  // แอดมินและช่างออกใบเสนอราคาได้
  if (p.role !== "admin" && p.role !== "technician") return { error: "ไม่มีสิทธิ์แก้ไขข้อมูล" } as const;
  return { db: await createClient() } as const;
}

/** เลขที่ถัดไป รูปแบบ QT2611-0001 (ปี ค.ศ. 2 หลัก + เดือน) */
export async function nextQuoteNo(): Promise<string> {
  const db = await createClient();
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "2-digit", month: "2-digit" })
    .format(new Date())
    .replace(/\D/g, "");
  const prefix = `QT${now}-`;
  const { data } = await db
    .from("quotations")
    .select("quote_no")
    .like("quote_no", `${prefix}%`)
    .order("quote_no", { ascending: false })
    .limit(1);
  const last = data?.[0]?.quote_no as string | undefined;
  const n = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(n) ? n : 1).padStart(4, "0")}`;
}

export async function saveQuote(input: QuoteInput, remember = false): Promise<QuoteResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };

  const quoteNo = input.quote_no.trim().toUpperCase();
  if (!quoteNo) return { error: "กรุณากรอกเลขที่ใบเสนอราคา" };
  if (!input.customer_name.trim()) return { error: "กรุณากรอกชื่อลูกค้า" };
  const items = input.items
    .map((i) => ({ ...i, description: i.description.trim(), qty: Number(i.qty) || 0, unit_price: Number(i.unit_price) || 0 }))
    .filter((i) => i.description);
  if (items.length === 0) return { error: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ" };

  const t = calcQuote(items, input.discount, input.vat_mode);
  const row = {
    quote_no: quoteNo,
    repair_job_id: input.repair_job_id || null,
    customer_id: input.customer_id || null,
    customer_name: input.customer_name.trim(),
    customer_address: input.customer_address.trim() || null,
    customer_phone: input.customer_phone.trim() || null,
    customer_tax_id: input.customer_tax_id.trim() || null,
    customer_branch: input.customer_branch.trim() || null,
    subject: input.subject.trim() || null,
    issue_date: input.issue_date,
    valid_days: Math.max(0, Math.round(Number(input.valid_days) || 0)),
    status: input.status,
    discount: Number(input.discount) || 0,
    vat_mode: input.vat_mode,
    subtotal: t.subtotal,
    vat_amount: t.vat,
    grand_total: t.grand,
    notes: input.notes.trim() || null,
    terms: input.terms.trim() || null,
  };

  const footer = mergeFooter(input.footer);
  const write = async (payload: Record<string, unknown>) => {
    if (input.id) {
      const { error } = await a.db.from("quotations").update(payload).eq("id", input.id);
      return { error, id: input.id };
    }
    const { data, error } = await a.db.from("quotations").insert(payload).select("id").single();
    return { error, id: (data?.id as string | undefined) ?? undefined };
  };
  let warn: string | undefined;
  let res = await write({ ...row, footer });
  // ยังไม่ได้รัน SQL 0009 (ไม่มีคอลัมน์ footer) → บันทึกส่วนอื่นไปก่อน
  if (res.error && /footer|schema cache/i.test(res.error.message)) {
    res = await write(row);
    warn = "บันทึกแล้ว แต่ส่วนท้ายเอกสารยังไม่ถูกเก็บ: รัน SQL 0009_quote_footer.sql ก่อน";
  }
  if (res.error || !res.id) {
    return { error: res.error?.code === "23505" ? "เลขที่ใบเสนอราคานี้ถูกใช้แล้ว" : res.error?.message ?? "บันทึกไม่สำเร็จ" };
  }
  const id = res.id;
  if (input.id) await a.db.from("quotation_items").delete().eq("quotation_id", id);

  const { error: itemErr } = await a.db.from("quotation_items").insert(
    items.map((i, idx) => ({
      quotation_id: id,
      sort: idx,
      description: i.description,
      qty: i.qty,
      unit: i.unit?.trim() || null,
      unit_price: i.unit_price,
    })),
  );
  if (itemErr) return { error: itemErr.message };

  // ราคาประเมินของงานซ่อม = ยอดใบเสนอราคาล่าสุด (ใช้ในข้อความ LINE / Pipeline)
  if (row.repair_job_id && row.status !== "rejected") {
    await a.db.from("repair_jobs").update({ quotation_price: t.grand }).eq("id", row.repair_job_id);
    revalidatePath(`/jobs/${row.repair_job_id}`);
  }
  // จำเงื่อนไข + ข้อความท้ายเอกสาร ไว้เป็นค่าเริ่มต้นของใบถัดไป
  if (remember) {
    try {
      const cur = await getSetting<{ footer?: Partial<QuoteFooter>; terms?: string }>("quote_defaults").catch(() => null);
      await setSetting("quote_defaults", {
        footer: mergeFooter(cur?.footer, { footer_text: footer.footer_text }),
        terms: row.terms ?? "",
      });
      revalidatePath("/settings");
    } catch {
      /* ไม่ทำให้การบันทึกใบเสนอราคาล้ม */
    }
  }
  revalidatePath("/quotes");
  return { ok: true, id, warn };
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<QuoteResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const { data, error } = await a.db.from("quotations").update({ status }).eq("id", id).select("repair_job_id").maybeSingle();
  if (error) return { error: error.message };
  revalidatePath("/quotes");
  if (data?.repair_job_id) revalidatePath(`/jobs/${data.repair_job_id}`);
  return { ok: true };
}

export async function deleteQuote(id: string): Promise<QuoteResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const { data, error } = await a.db.from("quotations").delete().eq("id", id).select("repair_job_id").maybeSingle();
  if (error) return { error: error.message };
  revalidatePath("/quotes");
  if (data?.repair_job_id) revalidatePath(`/jobs/${data.repair_job_id}`);
  return { ok: true };
}

export async function saveCompany(_p: QuoteResult, fd: FormData): Promise<QuoteResult> {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้น" };
  const g = (k: keyof Company) => String(fd.get(k) ?? "").trim();
  const company: Company = {
    name: g("name"),
    tax_id: g("tax_id"),
    branch: g("branch"),
    address: g("address"),
    phone: g("phone"),
    email: g("email"),
  };
  if (!company.name) return { error: "กรุณากรอกชื่อบริษัท" };
  try {
    await setSetting("company", company);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/** ค่าเริ่มต้นใบเสนอราคาใหม่: ส่วนท้ายเอกสาร + เงื่อนไข (แอดมิน) */
export async function saveQuoteDefaults(input: { footer: QuoteFooter; terms: string }): Promise<QuoteResult> {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้น" };
  try {
    await setSetting("quote_defaults", { footer: mergeFooter(input.footer), terms: input.terms.trim() });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
  revalidatePath("/settings");
  revalidatePath("/quotes", "layout");
  revalidatePath("/print", "layout");
  return { ok: true };
}
