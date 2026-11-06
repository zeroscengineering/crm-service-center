"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { deleteFile, driveReady } from "@/lib/google-drive";

export type DeleteResult = { ok?: boolean; error?: string; deleted?: number };

async function adminOnly() {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้นที่ลบได้" } as const;
  if (!adminConfigured()) return { error: "ยังไม่ได้ตั้ง SUPABASE_SERVICE_ROLE_KEY" } as const;
  return { db: createAdminClient() } as const;
}

/**
 * ลบงานซ่อม (หนึ่งหรือหลายงาน) พร้อมข้อมูลที่เกี่ยวข้อง:
 * โน้ต ไทม์ไลน์ อะไหล่ ขนส่ง (cascade) · ใบเสนอราคาของงาน · ไฟล์ใน Google Drive · เครื่องมือที่ไม่มีงานอื่นแล้ว
 * ข้อมูลลูกค้ายังอยู่
 */
export async function deleteJobs(ids: string[]): Promise<DeleteResult> {
  const g = await adminOnly();
  if ("error" in g) return { error: g.error };
  const jobIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 200);
  if (jobIds.length === 0) return { error: "ยังไม่ได้เลือกงาน" };
  const db = g.db;

  const [{ data: jobs }, { data: images }] = await Promise.all([
    db.from("repair_jobs").select("id, tool_id, customer_id").in("id", jobIds),
    db.from("repair_images").select("drive_file_id").in("repair_job_id", jobIds),
  ]);
  if (!jobs?.length) return { error: "ไม่พบงานที่เลือก" };

  // ไฟล์ใน Google Drive (ถ้าลบไม่สำเร็จ ไม่ขวางการลบงาน)
  if (images?.length && (await driveReady())) {
    await Promise.allSettled(images.map((i) => deleteFile(i.drive_file_id as string)));
  }

  // ใบเสนอราคาของงานเหล่านี้ (รายการในใบลบตาม cascade)
  const { error: qErr } = await db.from("quotations").delete().in("repair_job_id", jobIds);
  if (qErr && !/does not exist|schema cache/i.test(qErr.message)) return { error: `ลบใบเสนอราคาไม่สำเร็จ: ${qErr.message}` };

  const { error } = await db.from("repair_jobs").delete().in("id", jobIds);
  if (error) return { error: `ลบงานไม่สำเร็จ: ${error.message}` };

  // เครื่องมือที่ไม่มีงานเหลือแล้ว
  const toolIds = Array.from(new Set(jobs.map((j) => j.tool_id as string)));
  const { data: stillUsed } = await db.from("repair_jobs").select("tool_id").in("tool_id", toolIds);
  const used = new Set((stillUsed ?? []).map((r) => r.tool_id as string));
  const orphan = toolIds.filter((t) => !used.has(t));
  if (orphan.length) await db.from("tools").delete().in("id", orphan);

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/quotes");
  revalidatePath("/shipping");
  for (const c of new Set(jobs.map((j) => j.customer_id as string))) revalidatePath(`/customers/${c}`);
  return { ok: true, deleted: jobs.length };
}

/** ลบลูกค้าที่ไม่มีงานซ่อมเหลือ (เครื่องมือของลูกค้าลบตาม cascade) */
export async function deleteCustomer(customerId: string): Promise<DeleteResult> {
  const g = await adminOnly();
  if ("error" in g) return { error: g.error };
  const { count } = await g.db
    .from("repair_jobs")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);
  if ((count ?? 0) > 0) return { error: `ลูกค้านี้ยังมีงานซ่อม ${count} งาน ลบงานก่อน` };

  // แชท LINE ที่ผูกไว้: ยกเลิกการผูก (ไม่ลบประวัติแชท)
  await g.db.from("line_contacts").update({ customer_id: null }).eq("customer_id", customerId);
  const { error } = await g.db.from("customers").delete().eq("id", customerId);
  if (error) return { error: `ลบลูกค้าไม่สำเร็จ: ${error.message}` };
  revalidatePath("/customers");
  return { ok: true, deleted: 1 };
}
