"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { STATUSES, WARRANTY_LABEL, type RepairStatus } from "@/lib/constants";
import { autoNotifyStatus, sendJobMessage } from "@/lib/line";
import { siteUrl } from "@/lib/site-url";

export type ActionResult = { ok?: boolean; error?: string; info?: string };

/** ตรวจสิทธิ์แอดมินแบบคืน error แทนการ throw (ให้ UI แสดงข้อความได้) */
async function adminClient() {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้นที่แก้ไขข้อมูลได้" } as const;
  return { supabase: await createClient(), profile } as const;
}

function refresh(jobId: string) {
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
}

function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// ---------- สถานะ ----------
export async function updateStatus(jobId: string, status: RepairStatus): Promise<ActionResult> {
  if (!STATUSES.includes(status)) return { error: "สถานะไม่ถูกต้อง" };
  const ctx = await adminClient();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase.from("repair_jobs").update({ status }).eq("id", jobId);
  if (error) return { error: error.message };

  const sent = await autoNotifyStatus(jobId, status, await siteUrl(), ctx.profile.id);
  refresh(jobId);
  if (sent) {
    return sent.ok
      ? { ok: true, info: sent.mode === "live" ? "ส่ง LINE แจ้งลูกค้าแล้ว" : "บันทึกข้อความ LINE (โหมดจำลอง)" }
      : { ok: true, info: `ส่ง LINE ไม่สำเร็จ: ${sent.error}` };
  }
  return { ok: true };
}

// ---------- LINE ----------
export async function sendLineMessage(jobId: string, text: string): Promise<ActionResult> {
  const ctx = await adminClient();
  if ("error" in ctx) return { error: ctx.error };
  const body = text.trim();
  if (!body) return { error: "กรุณาพิมพ์ข้อความ" };
  const res = await sendJobMessage({ jobId, text: body, siteUrl: await siteUrl(), sentBy: ctx.profile.id });
  refresh(jobId);
  if (!res.ok) return { error: res.error ?? "ส่งไม่สำเร็จ" };
  return { ok: true, info: res.mode === "live" ? "ส่งถึงลูกค้าแล้ว ✓" : "บันทึกแล้ว (โหมดจำลอง — ยังไม่ได้ส่งจริง)" };
}

// ---------- ข้อมูลงาน ----------
export async function updateJobInfo(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await adminClient();
  if ("error" in ctx) return { error: ctx.error };
  const jobId = String(fd.get("job_id") ?? "");

  const issue = String(fd.get("issue_description") ?? "").trim();
  if (!issue) return { error: "กรุณากรอกอาการเสีย" };

  const warranty = String(fd.get("warranty") ?? "unknown");
  const technicianId = String(fd.get("technician_id") ?? "") || null;
  let technicianName: string | null = null;
  if (technicianId) {
    const { data } = await ctx.supabase.from("profiles").select("full_name").eq("id", technicianId).maybeSingle();
    technicianName = data?.full_name ?? null;
  }

  const splitList = (key: string) =>
    String(fd.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const { error } = await ctx.supabase
    .from("repair_jobs")
    .update({
      issue_description: issue,
      warranty: warranty in WARRANTY_LABEL ? warranty : "unknown",
      technician_id: technicianId,
      technician_name: technicianName,
      repair_notes: String(fd.get("repair_notes") ?? "").trim() || null,
      accessories: splitList("accessories"),
      received_documents: splitList("received_documents"),
    })
    .eq("id", jobId);

  if (error) return { error: error.message };
  refresh(jobId);
  return { ok: true };
}

// ---------- ค่าใช้จ่าย ----------
export async function updateCosts(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await adminClient();
  if ("error" in ctx) return { error: ctx.error };
  const jobId = String(fd.get("job_id") ?? "");

  const quotation = num(fd.get("quotation_price"));
  const labor = num(fd.get("labor_cost"));
  if (Number.isNaN(quotation) || Number.isNaN(labor)) return { error: "กรุณากรอกตัวเลขให้ถูกต้อง" };
  if ((quotation ?? 0) < 0 || (labor ?? 0) < 0) return { error: "จำนวนเงินต้องไม่ติดลบ" };

  const { error } = await ctx.supabase
    .from("repair_jobs")
    .update({ quotation_price: quotation, labor_cost: labor ?? 0 })
    .eq("id", jobId);

  if (error) return { error: error.message };
  refresh(jobId);
  return { ok: true };
}

// ---------- อะไหล่ ----------
export async function addPart(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await adminClient();
  if ("error" in ctx) return { error: ctx.error };
  const jobId = String(fd.get("job_id") ?? "");

  const name = String(fd.get("part_name") ?? "").trim();
  const qty = num(fd.get("quantity")) ?? 1;
  const price = num(fd.get("unit_price")) ?? 0;
  if (!name) return { error: "กรุณากรอกชื่ออะไหล่" };
  if (Number.isNaN(qty) || qty <= 0) return { error: "จำนวนต้องมากกว่า 0" };
  if (Number.isNaN(price) || price < 0) return { error: "ราคาไม่ถูกต้อง" };

  const { error } = await ctx.supabase.from("repair_parts").insert({
    repair_job_id: jobId,
    part_name: name,
    part_code: String(fd.get("part_code") ?? "").trim() || null,
    quantity: qty,
    unit_price: price,
  });

  if (error) return { error: error.message };
  refresh(jobId);
  return { ok: true };
}

export async function deletePart(jobId: string, partId: string): Promise<ActionResult> {
  const ctx = await adminClient();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from("repair_parts").delete().eq("id", partId).eq("repair_job_id", jobId);
  if (error) return { error: error.message };
  refresh(jobId);
  return { ok: true };
}

// ---------- โน้ต ----------
export async function addNote(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await adminClient();
  if ("error" in ctx) return { error: ctx.error };
  const jobId = String(fd.get("job_id") ?? "");
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { error: "กรุณาพิมพ์ข้อความ" };

  const { error } = await ctx.supabase.from("job_notes").insert({ repair_job_id: jobId, body });
  if (error) return { error: error.message };
  refresh(jobId);
  return { ok: true };
}
