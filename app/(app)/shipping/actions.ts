"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { sendJobMessage } from "@/lib/line";
import { siteUrl } from "@/lib/site-url";
import { trackingLink, type ShipmentStatus } from "@/lib/shipping";

export type ShipResult = { ok?: boolean; error?: string; info?: string };

/** งานขนส่งประจำวัน — แอดมินและช่างทำได้ */
async function admin() {
  const p = await requireProfile();
  return { supabase: await createClient(), profile: p } as const;
}

/** ตั้งค่ารายชื่อขนส่ง — เฉพาะแอดมิน */
async function systemAdmin() {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้นที่ตั้งค่ารายชื่อขนส่งได้" } as const;
  return { supabase: await createClient(), profile: p } as const;
}

function s(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

function refresh(jobId?: string | null) {
  revalidatePath("/shipping");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

// ---------- ตั้งค่าขนส่ง ----------
export async function saveCarrier(_p: ShipResult, fd: FormData): Promise<ShipResult> {
  const a = await systemAdmin();
  if ("error" in a) return { error: a.error };
  const id = s(fd, "id");
  const name = s(fd, "name");
  const url = s(fd, "tracking_url");
  if (!name) return { error: "กรุณากรอกชื่อขนส่ง" };
  if (url && !/^https?:\/\//.test(url)) return { error: "ลิงก์ติดตามต้องขึ้นต้นด้วย https://" };

  const row = {
    name,
    tracking_url: url || null,
    phone: s(fd, "phone") || null,
    active: fd.get("active") === "on",
    sort: Number(s(fd, "sort") || 100) || 100,
  };
  const { error } = id
    ? await a.supabase.from("carriers").update(row).eq("id", id)
    : await a.supabase.from("carriers").insert(row);
  if (error) return { error: error.code === "23505" ? "มีชื่อขนส่งนี้แล้ว" : error.message };
  refresh();
  return { ok: true };
}

export async function deleteCarrier(id: string): Promise<ShipResult> {
  const a = await systemAdmin();
  if ("error" in a) return { error: a.error };
  const { error } = await a.supabase.from("carriers").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function setCustomerCarrier(customerId: string, carrierId: string | null): Promise<ShipResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const { error } = await a.supabase.from("customers").update({ default_carrier_id: carrierId }).eq("id", customerId);
  if (error) return { error: error.message };
  revalidatePath("/shipping");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

// ---------- รายการขนส่ง ----------
export async function addShipment(_p: ShipResult, fd: FormData): Promise<ShipResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const jobId = s(fd, "repair_job_id");
  const carrierId = s(fd, "carrier_id") || null;

  const { data: job } = await a.supabase.from("repair_jobs").select("customer_id").eq("id", jobId).maybeSingle();
  if (!job) return { error: "ไม่พบงานซ่อม" };

  const cost = s(fd, "cost");
  const { error } = await a.supabase.from("shipments").insert({
    repair_job_id: jobId,
    customer_id: job.customer_id,
    direction: s(fd, "direction") === "inbound" ? "inbound" : "outbound",
    carrier_id: carrierId,
    tracking_no: s(fd, "tracking_no").toUpperCase() || null,
    sender_name: s(fd, "sender_name") || null,
    status: (s(fd, "status") as ShipmentStatus) || "pending",
    shipped_at: s(fd, "shipped_at") || null,
    cost: cost ? Number(cost) : null,
    note: s(fd, "note") || null,
  });
  if (error) return { error: error.message };

  // จำขนส่งที่ลูกค้าใช้ ถ้ายังไม่เคยตั้ง
  if (carrierId && job.customer_id) {
    await a.supabase
      .from("customers")
      .update({ default_carrier_id: carrierId })
      .eq("id", job.customer_id)
      .is("default_carrier_id", null);
  }
  refresh(jobId);
  return { ok: true };
}

export async function updateShipment(
  id: string,
  patch: { sender_name?: string | null; status?: ShipmentStatus; tracking_no?: string | null; carrier_id?: string | null },
): Promise<ShipResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const clean: Record<string, unknown> = {};
  if ("sender_name" in patch) clean.sender_name = patch.sender_name?.trim() || null;
  if ("tracking_no" in patch) clean.tracking_no = patch.tracking_no?.trim().toUpperCase() || null;
  if ("carrier_id" in patch) clean.carrier_id = patch.carrier_id || null;
  if (patch.status) {
    clean.status = patch.status;
    if (patch.status !== "pending") clean.shipped_at = new Date().toISOString().slice(0, 10);
  }
  const { data, error } = await a.supabase.from("shipments").update(clean).eq("id", id).select("repair_job_id").maybeSingle();
  if (error) return { error: error.message };
  refresh(data?.repair_job_id as string | null);
  return { ok: true };
}

export async function deleteShipment(id: string): Promise<ShipResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const { data } = await a.supabase.from("shipments").delete().eq("id", id).select("repair_job_id").maybeSingle();
  refresh(data?.repair_job_id as string | null);
  return { ok: true };
}

/** แจ้งเลขพัสดุให้ลูกค้าทาง LINE */
export async function notifyShipment(id: string): Promise<ShipResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const { data } = await a.supabase
    .from("shipments")
    .select("repair_job_id, tracking_no, carriers(name, tracking_url), repair_jobs(doc_no, customers(name))")
    .eq("id", id)
    .maybeSingle();
  const sh = data as unknown as {
    repair_job_id: string;
    tracking_no: string | null;
    carriers: { name: string; tracking_url: string | null } | null;
    repair_jobs: { doc_no: string; customers: { name: string } | null } | null;
  } | null;
  if (!sh?.repair_job_id) return { error: "ไม่พบรายการ" };

  const link = trackingLink(sh.carriers, sh.tracking_no);
  const text =
    `เรียนคุณ${sh.repair_jobs?.customers?.name ?? ""}\n` +
    `ทางร้านได้จัดส่งเครื่องงานซ่อมเลขที่ ${sh.repair_jobs?.doc_no ?? ""} แล้ว \n` +
    `ขนส่ง: ${sh.carriers?.name ?? "-"}\n` +
    (sh.tracking_no ? `เลขพัสดุ: ${sh.tracking_no}\n` : "") +
    (link ? `ติดตามพัสดุ: ${link}` : "");

  const r = await sendJobMessage({ jobId: sh.repair_job_id, text: text.trim(), siteUrl: await siteUrl(), sentBy: a.profile.id });
  refresh(sh.repair_job_id);
  if (!r.ok) return { error: r.error ?? "ส่งไม่สำเร็จ" };
  return { ok: true, info: r.mode === "live" ? "แจ้งลูกค้าทาง LINE แล้ว " : "บันทึกแล้ว (โหมดจำลอง)" };
}
