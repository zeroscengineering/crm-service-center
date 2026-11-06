"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { BRANDS, type Brand } from "@/lib/constants";
import { cleanSearch, normalizePhone } from "@/lib/format";
import type { CustomerWithTools } from "@/lib/types";
import { adminConfigured } from "@/lib/supabase/admin";
import { linkContact } from "@/lib/chat";
import { nextDocNo } from "@/lib/docno";

/** ค้นหาลูกค้าจากชื่อหรือเบอร์โทร (ใช้ในฟอร์มรับแจ้งซ่อม) */
export async function searchCustomers(query: string): Promise<CustomerWithTools[]> {
  await requireStaff();
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

/** ข้อมูลเครื่องแต่ละเครื่องจากฟอร์ม (ส่งมาเป็น JSON) */
export type ToolEntry = {
  tool_id: string; // "" = เครื่องใหม่
  brand: string;
  model: string;
  serial_number: string;
  issue_description: string;
  warranty: string;
  accessories: string[];
  received_documents: string[];
  repair_notes: string;
};

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function clean(list: string[]) {
  return Array.from(new Set(list.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean)));
}

export async function createJob(_prev: CreateJobState, fd: FormData): Promise<CreateJobState> {
  await requireStaff();
  const supabase = await createClient();
  const fieldErrors: Record<string, string> = {};

  // ---------- เครื่อง ----------
  let tools: ToolEntry[] = [];
  try {
    tools = JSON.parse(str(fd, "tools") || "[]") as ToolEntry[];
  } catch {
    return { error: "ข้อมูลเครื่องไม่ถูกต้อง" };
  }
  if (tools.length === 0) return { error: "กรุณาเพิ่มเครื่องอย่างน้อย 1 เครื่อง" };
  tools.forEach((t, i) => {
    if (!t.tool_id) {
      if (!BRANDS.includes(t.brand as Brand)) fieldErrors[`t${i}.brand`] = "เลือกแบรนด์";
      if (!t.model.trim()) fieldErrors[`t${i}.model`] = "กรอกรุ่น";
    }
    if (!t.issue_description.trim()) fieldErrors[`t${i}.issue`] = "กรอกอาการเสีย";
  });

  // ---------- เลขที่เอกสาร ----------
  const manual = str(fd, "doc_mode") === "manual" && tools.length === 1;
  const manualDoc = str(fd, "doc_no").toUpperCase();
  if (manual && !manualDoc) fieldErrors.doc_no = "กรุณากรอกเลขที่เอกสาร";

  // ---------- ลูกค้า ----------
  const customerId = str(fd, "customer_id");
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

  if (Object.keys(fieldErrors).length) return { error: "กรุณาตรวจสอบข้อมูลที่ไฮไลต์", fieldErrors };

  if (manual) {
    const { data: dup } = await supabase.from("repair_jobs").select("id").eq("doc_no", manualDoc).maybeSingle();
    if (dup) return { error: "เลขที่เอกสารนี้ถูกใช้แล้ว", fieldErrors: { doc_no: "เลขที่เอกสารซ้ำ" } };
  }

  const created = { customer: null as string | null, tools: [] as string[], jobs: [] as string[] };
  async function rollback() {
    if (created.jobs.length) await supabase.from("repair_jobs").delete().in("id", created.jobs);
    if (created.tools.length) await supabase.from("tools").delete().in("id", created.tools);
    if (created.customer) await supabase.from("customers").delete().eq("id", created.customer);
  }

  let finalCustomerId = customerId;
  if (!finalCustomerId) {
    const { data, error } = await supabase.from("customers").insert(customerInput).select("id").single();
    if (error || !data) return { error: `บันทึกลูกค้าไม่สำเร็จ: ${error?.message ?? ""}` };
    finalCustomerId = data.id as string;
    created.customer = finalCustomerId;
  }

  const technicianId = str(fd, "technician_id") || null;
  let technicianName: string | null = null;
  if (technicianId) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", technicianId).maybeSingle();
    technicianName = data?.full_name ?? null;
  }

  const shared = {
    customer_id: finalCustomerId,
    branch_id: str(fd, "branch_id") || null,
    technician_id: technicianId,
    technician_name: technicianName,
    received_at: str(fd, "received_at") || undefined,
  };

  for (const t of tools) {
    let toolId = t.tool_id;
    if (!toolId) {
      const { data, error } = await supabase
        .from("tools")
        .insert({
          customer_id: finalCustomerId,
          brand: t.brand,
          model: t.model.trim(),
          serial_number: t.serial_number.trim().toUpperCase() || null,
        })
        .select("id")
        .single();
      if (error || !data) {
        await rollback();
        return { error: `บันทึกเครื่องมือไม่สำเร็จ: ${error?.message ?? ""}` };
      }
      toolId = data.id as string;
      created.tools.push(toolId);
    }

    const jobRow = {
      ...shared,
      tool_id: toolId,
      issue_description: t.issue_description.trim(),
      warranty: ["in_warranty", "out_of_warranty", "unknown"].includes(t.warranty) ? t.warranty : "unknown",
      accessories: clean(t.accessories),
      received_documents: clean(t.received_documents),
      repair_notes: t.repair_notes.trim() || null,
    };

    // เลขรันอัตโนมัติ: ถ้าชนกัน (มีคนบันทึกพร้อมกัน) ขยับเลขถัดไปให้เอง
    let jobId: string | null = null;
    let lastErr = "";
    for (let attempt = 0; attempt < 6 && !jobId; attempt++) {
      const docNo = manual ? manualDoc : await nextDocNo(supabase, attempt);
      const { data, error } = await supabase
        .from("repair_jobs")
        .insert({ ...jobRow, doc_no: docNo })
        .select("id")
        .single();
      if (data) jobId = data.id as string;
      else {
        lastErr = error?.code === "23505" ? "เลขที่เอกสารซ้ำ" : error?.message ?? "";
        if (manual || error?.code !== "23505") break;
      }
    }
    if (!jobId) {
      await rollback();
      return { error: `บันทึกงานซ่อมไม่สำเร็จ: ${lastErr}` };
    }
    created.jobs.push(jobId);
  }

  const carrierId = str(fd, "carrier_id");
  if (carrierId) await supabase.from("customers").update({ default_carrier_id: carrierId }).eq("id", finalCustomerId);

  const lineUserId = str(fd, "line_user_id");
  if (lineUserId && adminConfigured()) {
    await linkContact(lineUserId, finalCustomerId).catch((e) => console.error("[link contact]", e));
    revalidatePath("/chat");
  }

  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  redirect(
    created.jobs.length === 1 ? `/print/job/${created.jobs[0]}?new=1` : `/print/jobs?ids=${created.jobs.join(",")}&new=1`,
  );
}
