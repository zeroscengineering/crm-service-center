"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

export type SaveState = { error?: string; ok?: boolean };

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function updateCustomer(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireStaff();
  const id = s(fd, "id");
  const name = s(fd, "name");
  const phone = normalizePhone(s(fd, "phone"));
  const email = s(fd, "email");
  if (!name) return { error: "กรุณากรอกชื่อ" };
  if (phone.length < 9) return { error: "เบอร์โทรไม่ถูกต้อง" };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "อีเมลไม่ถูกต้อง" };

  const supabase = await createClient();
  const base = {
    name,
    phone,
    line_id: s(fd, "line_id") || null,
    address: s(fd, "address") || null,
  };
  const extra = {
    company_name: s(fd, "company_name") || null,
    contact_person: s(fd, "contact_person") || null,
    email: email || null,
    tax_id: s(fd, "tax_id") || null,
    tax_branch: s(fd, "tax_branch") || null,
    owner_id: s(fd, "owner_id") || null,
  };
  let { error } = await supabase.from("customers").update({ ...base, ...extra }).eq("id", id);
  // ยังไม่ได้รัน SQL 0008 → บันทึกเฉพาะช่องเดิม
  if (error && /column .* does not exist|schema cache/i.test(error.message)) {
    ({ error } = await supabase.from("customers").update(base).eq("id", id));
    if (!error) {
      revalidatePath(`/customers/${id}`);
      return { error: "บันทึกข้อมูลหลักแล้ว แต่ช่องใหม่ (บริษัท ผู้ดูแล ฯลฯ) ต้องรัน SQL 0008 ก่อน" };
    }
  }
  if (error) return { error: error.message };
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  return { ok: true };
}

export async function unlinkLine(customerId: string): Promise<SaveState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ line_user_id: null }).eq("id", customerId);
  if (error) return { error: error.message };
  await supabase.from("line_contacts").update({ customer_id: null }).eq("customer_id", customerId);
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

// ---------- โน้ตภายใน ----------
export async function addCustomerNote(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireStaff();
  const customerId = s(fd, "customer_id");
  const body = s(fd, "body");
  if (!body) return { error: "กรุณาพิมพ์โน้ต" };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_notes").insert({ customer_id: customerId, body });
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

export async function deleteCustomerNote(customerId: string, noteId: string): Promise<SaveState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("customer_notes").delete().eq("id", noteId).eq("customer_id", customerId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

// ---------- แท็ก ----------
const TAG_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

export async function toggleCustomerTag(customerId: string, tagId: string, on: boolean): Promise<SaveState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("customer_tags").upsert({ customer_id: customerId, tag_id: tagId }, { ignoreDuplicates: true })
    : await supabase.from("customer_tags").delete().eq("customer_id", customerId).eq("tag_id", tagId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { ok: true };
}

export async function createCustomerTag(customerId: string, name: string): Promise<SaveState> {
  await requireStaff();
  const n = name.trim().slice(0, 40);
  if (!n) return { error: "กรุณาพิมพ์ชื่อแท็ก" };
  const supabase = await createClient();
  // ใช้แท็กเดิมถ้ามีชื่อนี้แล้ว (ไม่เปลี่ยนสี)
  let { data } = await supabase.from("tags").select("id").eq("name", n).maybeSingle();
  if (!data) {
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const ins = await supabase.from("tags").insert({ name: n, color }).select("id").single();
    if (ins.error || !ins.data) return { error: ins.error?.message ?? "สร้างแท็กไม่ได้" };
    data = ins.data;
  }
  const { error } = await supabase
    .from("customer_tags")
    .upsert({ customer_id: customerId, tag_id: data.id }, { ignoreDuplicates: true });
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
