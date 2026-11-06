"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { BRANDS, type Brand } from "@/lib/constants";
import { cleanSearch, normalizePhone } from "@/lib/format";
import type { CustomerWithTools } from "@/lib/types";
import { adminConfigured } from "@/lib/supabase/admin";
import { linkContact } from "@/lib/chat";

/** ค้นหาลูกค้าจากชื่อหรือเบอร์โทร (ใช้ในฟอร์มรับแจ้งซ่อม) */
export async function searchCustomers(query: string): Promise<CustomerWithTools[]> {
  await requireAdmin();
  const q = cleanSearch(query);
  if (q.length < 2) return [];

  const digits = normalizePhone(q);
  const filters = [`name.ilike.%${q}%`];
  if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*, tools(*)")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(8);

  return (data ?? []) as CustomerWithTools[];
}

export type CreateJobState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function list(fd: FormData, key: string, otherKey: string) {
  const items = fd.getAll(key).map((v) => String(v).trim()).filter(Boolean);
  const other = str(fd, otherKey);
  if (other) items.push(...other.split(",").map((s) => s.trim()).filter(Boolean));
  return Array.from(new Set(items));
}

export async function createJob(_prev: CreateJobState, fd: FormData): Promise<CreateJobState> {
  await requireAdmin();
  const supabase = await createClient();

  const fieldErrors: Record<string, string> = {};

  const docNo = str(fd, "doc_no").toUpperCase();
  const customerId = str(fd, "customer_id");
  const toolId = str(fd, "tool_id");
  const issue = str(fd, "issue_description");

  if (!docNo) fieldErrors.doc_no = "กรุณากรอกเลขที่เอกสาร";
  if (!issue) fieldErrors.issue_description = "กรุณากรอกอาการเสีย";

  // ลูกค้า
  const customerInput = {
    name: str(fd, "customer_name"),
    phone: normalizePhone(str(fd, "customer_phone")),
    line_id: str(fd, "customer_line_id") || null,
    address: str(fd, "customer_address") || null,
  };
  if (!customerId) {
    if (!customerInput.name) fieldErrors.customer_name = "กรุณากรอกชื่อลูกค้า";
    if (customerInput.phone.length < 9) fieldErrors.customer_phone = "เบอร์โทรไม่ถูกต้อง";
  }

  // เครื่องมือ
  const brand = str(fd, "brand") as Brand;
  const toolInput = {
    brand,
    model: str(fd, "model"),
    serial_number: str(fd, "serial_number").toUpperCase() || null,
  };
  if (!toolId) {
    if (!BRANDS.includes(brand)) fieldErrors.brand = "กรุณาเลือกแบรนด์";
    if (!toolInput.model) fieldErrors.model = "กรุณากรอกรุ่น";
  }

  if (Object.keys(fieldErrors).length) {
    return { error: "กรุณาตรวจสอบข้อมูลที่ไฮไลต์", fieldErrors };
  }

  // เลขที่เอกสารห้ามซ้ำ
  const { data: dup } = await supabase
    .from("repair_jobs")
    .select("id")
    .eq("doc_no", docNo)
    .maybeSingle();
  if (dup) {
    return { error: "เลขที่เอกสารนี้ถูกใช้แล้ว", fieldErrors: { doc_no: "เลขที่เอกสารซ้ำ" } };
  }

  let createdCustomerId: string | null = null;
  let createdToolId: string | null = null;

  // rollback แบบง่าย หากขั้นตอนถัดไปล้มเหลว
  async function cleanup() {
    if (createdToolId) await supabase.from("tools").delete().eq("id", createdToolId);
    if (createdCustomerId) await supabase.from("customers").delete().eq("id", createdCustomerId);
  }

  let finalCustomerId = customerId;
  if (!finalCustomerId) {
    const { data, error } = await supabase
      .from("customers")
      .insert(customerInput)
      .select("id")
      .single();
    if (error || !data) return { error: `บันทึกลูกค้าไม่สำเร็จ: ${error?.message ?? ""}` };
    finalCustomerId = data.id;
    createdCustomerId = data.id;
  }

  let finalToolId = toolId;
  if (!finalToolId) {
    const { data, error } = await supabase
      .from("tools")
      .insert({ ...toolInput, customer_id: finalCustomerId })
      .select("id")
      .single();
    if (error || !data) {
      await cleanup();
      return { error: `บันทึกเครื่องมือไม่สำเร็จ: ${error?.message ?? ""}` };
    }
    finalToolId = data.id;
    createdToolId = data.id;
  }

  const technicianId = str(fd, "technician_id") || null;
  let technicianName: string | null = null;
  if (technicianId) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", technicianId)
      .maybeSingle();
    technicianName = data?.full_name ?? null;
  }

  const { data: job, error: jobError } = await supabase
    .from("repair_jobs")
    .insert({
      doc_no: docNo,
      customer_id: finalCustomerId,
      tool_id: finalToolId,
      branch_id: str(fd, "branch_id") || null,
      issue_description: issue,
      warranty: str(fd, "warranty") || "unknown",
      accessories: list(fd, "accessories", "accessories_other"),
      received_documents: list(fd, "received_documents", "documents_other"),
      repair_notes: str(fd, "repair_notes") || null,
      technician_id: technicianId,
      technician_name: technicianName,
      received_at: str(fd, "received_at") || undefined,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    await cleanup();
    const msg = jobError?.code === "23505" ? "เลขที่เอกสารซ้ำ" : jobError?.message ?? "";
    return { error: `บันทึกงานซ่อมไม่สำเร็จ: ${msg}` };
  }

  // ขนส่งที่ลูกค้าใช้
  const carrierId = str(fd, "carrier_id");
  if (carrierId) {
    await supabase.from("customers").update({ default_carrier_id: carrierId }).eq("id", finalCustomerId);
  }
  // สร้างจากแชท LINE → ผูกแชทกับลูกค้า
  const lineUserId = str(fd, "line_user_id");
  if (lineUserId && adminConfigured()) {
    await linkContact(lineUserId, finalCustomerId).catch((e) => console.error("[link contact]", e));
    revalidatePath("/chat");
  }

  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  redirect(`/print/job/${job.id}?new=1`);
}
