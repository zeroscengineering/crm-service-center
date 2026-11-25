"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { ReturnableJob, ReturnItem, ReturnStatus } from "@/lib/return-note";

export type ReturnInput = {
  id?: string;
  note_no: string;
  customer_id: string | null;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  attention: string;
  destination_note: string;
  issue_date: string;
  status: ReturnStatus;
  notes: string;
  items: ReturnItem[];
};
export type ReturnResult = { ok?: boolean; error?: string; id?: string };

async function staff() {
  const p = await requireProfile();
  if (p.role !== "admin" && p.role !== "technician") return { error: "ไม่มีสิทธิ์แก้ไขข้อมูล" } as const;
  return { db: await createClient(), role: p.role } as const;
}

/** เลขที่ถัดไป รูปแบบ RN2611-0001 (ปี ค.ศ. 2 หลัก + เดือน) */
export async function nextReturnNo(): Promise<string> {
  const db = await createClient();
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "2-digit", month: "2-digit" })
    .format(new Date())
    .replace(/\D/g, "");
  const prefix = `RN${ym}-`;
  const { data } = await db.from("return_notes").select("note_no").like("note_no", `${prefix}%`).order("note_no", { ascending: false }).limit(1);
  const last = data?.[0]?.note_no as string | undefined;
  const n = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(n) ? n : 1).padStart(4, "0")}`;
}

/** งานซ่อมสำหรับเลือกใส่ใบส่งคืน: ระบุ ids, หรือค้นจากเลขที่/ชื่อลูกค้า, หรือ (ว่าง) งานในสถานะ "ซ่อมเสร็จพร้อมส่งคืน" */
export async function loadReturnableJobs(opts: { ids?: string[]; query?: string; status?: string }): Promise<ReturnableJob[]> {
  await requireProfile();
  const db = await createClient();
  let sel = db
    .from("repair_jobs")
    .select("id, doc_no, status, accessories, customer_id, customers(*), tools(brand, model, serial_number)")
    .order("doc_no", { ascending: true })
    .limit(60);
  if (opts.ids?.length) sel = sel.in("id", opts.ids);
  else if (opts.query?.trim()) {
    const q = opts.query.trim().replace(/[%,()*]/g, "");
    sel = sel.ilike("doc_no", `%${q}%`);
  } else sel = sel.eq("status", opts.status ?? "ready");
  let { data } = await sel;
  // ค้นด้วยชื่อลูกค้า/เบอร์ ถ้าเลขที่เอกสารไม่เจอ
  if (!opts.ids?.length && opts.query?.trim() && !(data ?? []).length) {
    const q = opts.query.trim().replace(/[%,()*]/g, "");
    ({ data } = await db
      .from("repair_jobs")
      .select("id, doc_no, status, accessories, customer_id, customers!inner(*), tools(brand, model, serial_number)")
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`, { referencedTable: "customers" })
      .order("created_at", { ascending: false })
      .limit(30));
  }
  return ((data ?? []) as unknown as {
    id: string;
    doc_no: string;
    status: string;
    accessories: string[] | null;
    customer_id: string | null;
    customers: { name: string; phone: string | null; address: string | null; company_name?: string | null } | null;
    tools: { brand: string; model: string; serial_number: string | null } | null;
  }[]).map((r) => ({
    id: r.id,
    doc_no: r.doc_no,
    status: r.status,
    customer_id: r.customer_id,
    customer_name: r.customers?.company_name || r.customers?.name || "",
    customer_phone: r.customers?.phone ?? "",
    customer_address: r.customers?.address ?? "",
    description: r.tools ? `${r.tools.brand} ${r.tools.model}` : "",
    serial_no: r.tools?.serial_number ?? "",
    accessories: r.accessories ?? [],
  }));
}

export async function saveReturnNote(input: ReturnInput): Promise<ReturnResult> {
  const a = await staff();
  if ("error" in a) return { error: a.error };
  const noteNo = input.note_no.trim().toUpperCase();
  if (!noteNo) return { error: "กรุณากรอกเลขที่เอกสาร" };
  if (!input.customer_name.trim()) return { error: "กรุณากรอกชื่อลูกค้า" };
  const items = input.items
    .map((i) => ({
      job_id: i.job_id || null,
      doc_no: i.doc_no.trim(),
      description: i.description.trim(),
      serial_no: i.serial_no.trim(),
      qty: Number(i.qty) || 0,
      unit: i.unit.trim(),
      remark: i.remark.trim(),
    }))
    .filter((i) => i.description || i.doc_no);
  if (!items.length) return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };

  const row = {
    note_no: noteNo,
    customer_id: input.customer_id || null,
    customer_name: input.customer_name.trim(),
    customer_address: input.customer_address.trim() || null,
    customer_phone: input.customer_phone.trim() || null,
    attention: input.attention.trim() || null,
    destination_note: input.destination_note.trim() || null,
    issue_date: input.issue_date,
    status: input.status,
    notes: input.notes.trim() || null,
    items,
  };
  let id = input.id;
  if (id) {
    const { error } = await a.db.from("return_notes").update(row).eq("id", id);
    if (error) return { error: error.code === "23505" ? "เลขที่เอกสารนี้ถูกใช้แล้ว" : error.message };
  } else {
    const { data, error } = await a.db.from("return_notes").insert(row).select("id").single();
    if (error || !data) return { error: error?.code === "23505" ? "เลขที่เอกสารนี้ถูกใช้แล้ว" : error?.message ?? "บันทึกไม่สำเร็จ" };
    id = data.id as string;
  }
  revalidatePath("/returns");
  for (const jid of new Set(items.map((i) => i.job_id).filter(Boolean) as string[])) revalidatePath(`/jobs/${jid}`);
  return { ok: true, id };
}

export async function deleteReturnNote(id: string): Promise<ReturnResult> {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้น" };
  const db = await createClient();
  const { error } = await db.from("return_notes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/returns");
  return { ok: true };
}
