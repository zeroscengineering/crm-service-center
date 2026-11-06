"use server";

import { revalidatePath } from "next/cache";
import { isHexColor, randomTagColor } from "@/lib/tag-colors";
import { requireProfile } from "@/lib/auth";
import { adminConfigured } from "@/lib/supabase/admin";
import { getLineConfig, lineReady, pushText } from "@/lib/line";
import { linkContact, recordOutbound } from "@/lib/chat";

export type ChatResult = { ok?: boolean; error?: string; info?: string };

async function guard() {
  const p = await requireProfile();
  void p; // แอดมินและช่างตอบแชทได้
  if (!adminConfigured()) return { error: "ยังไม่ได้ตั้ง SUPABASE_SERVICE_ROLE_KEY" } as const;
  return { profile: p } as const;
}

export async function sendChat(lineUserId: string, text: string): Promise<ChatResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const body = text.trim();
  if (!body) return { error: "กรุณาพิมพ์ข้อความ" };

  const cfg = await getLineConfig();
  if (!lineReady(cfg)) return { error: "ยังไม่ได้ตั้งค่า LINE ในหน้าตั้งค่า" };

  if (cfg.mode === "mock") {
    await recordOutbound({ lineUserId, text: body, status: "mock", sentBy: g.profile.id });
    revalidatePath("/chat");
    return { ok: true, info: "บันทึกแล้ว (โหมดจำลอง — ยังไม่ส่งถึงลูกค้า)" };
  }

  try {
    await pushText(cfg.access_token, lineUserId, body);
    await recordOutbound({ lineUserId, text: body, status: "sent", sentBy: g.profile.id });
    revalidatePath("/chat");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ส่งไม่สำเร็จ";
    await recordOutbound({ lineUserId, text: body, status: "failed", error: msg, sentBy: g.profile.id });
    revalidatePath("/chat");
    return { error: msg };
  }
}

export async function linkChatCustomer(lineUserId: string, customerId: string | null): Promise<ChatResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  await linkContact(lineUserId, customerId);
  revalidatePath("/chat");
  revalidatePath("/customers");
  return { ok: true };
}

/** ตั้งคนที่ทักมาทาง LINE เป็นลูกค้าใหม่ทันที (ไม่ต้องรับแจ้งซ่อมก่อน) แล้วผูกแชทให้อัตโนมัติ */
export async function createCustomerFromChat(
  lineUserId: string,
  input: { name: string; phone: string; company_name: string },
): Promise<ChatResult & { id?: string }> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const name = input.name.trim().slice(0, 120);
  const phone = input.phone.replace(/\D/g, "");
  const company = input.company_name.trim();
  if (!name) return { error: "กรุณากรอกชื่อลูกค้า" };
  if (phone && phone.length < 9) return { error: "เบอร์โทรไม่ถูกต้อง (เว้นว่างไว้ก่อนได้)" };

  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const base: Record<string, string> = { name, phone, line_user_id: lineUserId };
  const full: Record<string, string> = company ? { ...base, company_name: company } : base;
  let res = await db.from("customers").insert(full).select("id").single();
  // ยังไม่ได้รัน SQL 0008 (ไม่มีคอลัมน์ company_name) → บันทึกเฉพาะช่องหลัก
  if (res.error && company && /company_name|schema cache/i.test(res.error.message)) {
    res = await db.from("customers").insert(base).select("id").single();
  }
  if (res.error || !res.data) return { error: res.error?.message ?? "สร้างลูกค้าไม่ได้" };
  const id = res.data.id as string;
  await linkContact(lineUserId, id);
  revalidatePath("/chat");
  revalidatePath("/customers");
  return { ok: true, id };
}

// ---------- ผูกดีล (งานซ่อม) ที่มีอยู่แล้วกับแชท ----------
export type AssignableJob = {
  id: string;
  doc_no: string;
  status: string;
  customer_id: string;
  customer_name: string;
  tool: string;
};

/** ค้นหางานซ่อมจากเลขที่เอกสาร / ชื่อลูกค้า / รุ่นเครื่อง (ว่าง = งานล่าสุด) */
export async function searchAssignableJobs(query: string, excludeCustomerId?: string | null): Promise<AssignableJob[]> {
  await requireProfile();
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const q = query.trim().replace(/[%,()*]/g, "");
  let sel = db
    .from("repair_jobs")
    .select("id, doc_no, status, customer_id, customers!inner(name, phone), tools(brand, model)")
    .order("created_at", { ascending: false })
    .limit(10);
  if (excludeCustomerId) sel = sel.neq("customer_id", excludeCustomerId);
  if (q) {
    // ค้นเลขที่เอกสารก่อน ถ้าไม่เจอค่อยค้นชื่อลูกค้า
    const byDoc = await sel.ilike("doc_no", `%${q}%`);
    let rows = byDoc.data ?? [];
    if (rows.length === 0) {
      let s2 = db
        .from("repair_jobs")
        .select("id, doc_no, status, customer_id, customers!inner(name, phone), tools(brand, model)")
        .or(`name.ilike.%${q}%,phone.ilike.%${q.replace(/\D/g, "") || q}%`, { referencedTable: "customers" })
        .order("created_at", { ascending: false })
        .limit(10);
      if (excludeCustomerId) s2 = s2.neq("customer_id", excludeCustomerId);
      rows = (await s2).data ?? [];
    }
    return mapJobs(rows);
  }
  return mapJobs((await sel).data ?? []);
}

function mapJobs(rows: unknown[]): AssignableJob[] {
  return (rows as {
    id: string;
    doc_no: string;
    status: string;
    customer_id: string;
    customers: { name: string } | null;
    tools: { brand: string; model: string } | null;
  }[]).map((r) => ({
    id: r.id,
    doc_no: r.doc_no,
    status: r.status,
    customer_id: r.customer_id,
    customer_name: r.customers?.name ?? "-",
    tool: r.tools ? `${r.tools.brand} ${r.tools.model}` : "",
  }));
}

/** ย้ายงานซ่อม (พร้อมเครื่อง ใบเสนอราคา และการส่งของของงานนั้น) มาเป็นของลูกค้าที่ผูกกับแชทนี้
 *  ผลคือแจ้งเตือนสถานะงานจะส่งเข้า LINE คนนี้ */
export async function assignJobToChat(lineUserId: string, jobId: string): Promise<ChatResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();

  const { data: contact } = await db.from("line_contacts").select("customer_id").eq("line_user_id", lineUserId).maybeSingle();
  const target = contact?.customer_id as string | null | undefined;
  if (!target) return { error: "ตั้งแชทนี้เป็นลูกค้าก่อน แล้วค่อยเลือกดีล" };

  const { data: job } = await db.from("repair_jobs").select("id, customer_id, tool_id").eq("id", jobId).maybeSingle();
  if (!job) return { error: "ไม่พบงานซ่อม" };
  if (job.customer_id === target) return { ok: true, info: "งานนี้เป็นของลูกค้าคนนี้อยู่แล้ว" };
  const oldCustomer = job.customer_id as string;

  // ย้ายเครื่องมือ และงานทุกงานของเครื่องนั้นที่เป็นของลูกค้าเดิม (ให้ข้อมูลตรงกัน)
  const { error: toolErr } = await db.from("tools").update({ customer_id: target }).eq("id", job.tool_id);
  if (toolErr) return { error: toolErr.message };
  const { data: moved, error: jobErr } = await db
    .from("repair_jobs")
    .update({ customer_id: target })
    .eq("tool_id", job.tool_id)
    .eq("customer_id", oldCustomer)
    .select("id");
  if (jobErr) return { error: jobErr.message };
  const ids = (moved ?? []).map((r) => r.id as string);
  if (ids.length) {
    await db.from("quotations").update({ customer_id: target }).in("repair_job_id", ids);
    await db.from("shipments").update({ customer_id: target }).in("repair_job_id", ids);
  }

  revalidatePath("/chat");
  revalidatePath("/jobs", "layout");
  revalidatePath("/customers", "layout");
  return { ok: true, info: ids.length > 1 ? `ย้ายแล้ว ${ids.length} งาน (เครื่องเดียวกัน)` : "ผูกดีลกับแชทนี้แล้ว" };
}

// ---------- แท็ก ----------

export async function createTag(name: string, lineUserId?: string, pickedColor?: string): Promise<ChatResult & { id?: string }> {
  const p = await requireProfile();
  void p; // แอดมินและช่างทำได้
  const n = name.trim().slice(0, 40);
  if (!n) return { error: "กรุณาพิมพ์ชื่อแท็ก" };
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const color = isHexColor(pickedColor) ? pickedColor : randomTagColor();
  const { data, error } = await db.from("tags").upsert({ name: n, color }, { onConflict: "name", ignoreDuplicates: false }).select("id").single();
  if (error || !data) return { error: error?.message ?? "สร้างแท็กไม่ได้" };
  if (lineUserId) await db.from("contact_tags").upsert({ line_user_id: lineUserId, tag_id: data.id }, { ignoreDuplicates: true });
  revalidatePath("/chat");
  return { ok: true, id: data.id as string };
}

export async function toggleContactTag(lineUserId: string, tagId: string, on: boolean): Promise<ChatResult> {
  const p = await requireProfile();
  void p; // แอดมินและช่างทำได้
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const { error } = on
    ? await db.from("contact_tags").upsert({ line_user_id: lineUserId, tag_id: tagId }, { ignoreDuplicates: true })
    : await db.from("contact_tags").delete().eq("line_user_id", lineUserId).eq("tag_id", tagId);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

/** เปลี่ยนสีแท็ก (มีผลทุกแชทและทุกลูกค้าที่ใช้แท็กนี้) */
export async function updateTagColor(tagId: string, color: string): Promise<ChatResult> {
  const p = await requireProfile();
  void p; // แอดมินและช่างทำได้
  if (!isHexColor(color)) return { error: "สีไม่ถูกต้อง" };
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const { error } = await db.from("tags").update({ color }).eq("id", tagId);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  revalidatePath("/customers", "layout");
  return { ok: true };
}

export async function deleteTag(tagId: string): Promise<ChatResult> {
  const p = await requireProfile();
  void p; // แอดมินและช่างทำได้
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const { error } = await db.from("tags").delete().eq("id", tagId);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}
