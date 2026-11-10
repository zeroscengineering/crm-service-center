"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isHexColor } from "@/lib/tag-colors";
import type { StatusDef, StatusKind } from "@/lib/status-def";

export type StatusResult = { ok?: boolean; error?: string };

async function admin() {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้น" } as const;
  return { db: await createClient() } as const;
}

function refreshAll() {
  // สถานะใช้ทุกหน้า (Pipeline, แดชบอร์ด, แชท, หน้าติดตาม)
  revalidatePath("/", "layout");
}

/** เรียงลำดับใหม่เป็น 10, 20, 30, ... ตามลำดับใน keys */
async function resequence(db: Awaited<ReturnType<typeof createClient>>, keys: string[]) {
  await Promise.all(keys.map((key, i) => db.from("job_statuses").update({ sort: (i + 1) * 10 }).eq("key", key)));
}

async function loadAll(db: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await db.from("job_statuses").select("*").order("sort");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as StatusDef[];
}

export async function saveStatus(input: {
  key?: string;
  label: string;
  color: string;
  kind: StatusKind;
  hidden: boolean;
  line_message: string;
}): Promise<StatusResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const label = input.label.trim().slice(0, 60);
  if (!label) return { error: "กรุณากรอกชื่อสถานะ" };
  if (!isHexColor(input.color)) return { error: "สีไม่ถูกต้อง" };
  const kind: StatusKind = ["open", "done", "cancelled"].includes(input.kind) ? input.kind : "open";

  try {
    const all = await loadAll(a.db);
    if (all.some((s) => s.label.trim() === label && s.key !== input.key)) return { error: `มีสถานะชื่อ "${label}" อยู่แล้ว` };

    if (input.key) {
      const cur = all.find((s) => s.key === input.key);
      if (!cur) return { error: "ไม่พบสถานะ" };
      const patch: Record<string, unknown> = {
        label,
        color: input.color,
        line_message: input.line_message.trim() || null,
        // "รับเรื่องซ่อม" เป็นสถานะแรกของงานใหม่ ซ่อนไม่ได้
        hidden: cur.key === "received" ? false : Boolean(input.hidden),
      };
      // สถานะตั้งต้นของระบบ: ประเภท (ยังไม่ปิด/ปิดงาน/ยกเลิก) คงเดิม
      if (!cur.is_system) patch.kind = kind;
      const { error } = await a.db.from("job_statuses").update(patch).eq("key", cur.key);
      if (error) return { error: error.message };
    } else {
      const key = `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
      const { error } = await a.db.from("job_statuses").insert({
        key,
        label,
        color: input.color,
        kind,
        hidden: Boolean(input.hidden),
        line_message: input.line_message.trim() || null,
        is_system: false,
        sort: 9999,
      });
      if (error) return { error: error.message };
      // วางสถานะใหม่: ประเภท "ยังไม่ปิด" ต่อท้ายสถานะยังไม่ปิดตัวสุดท้าย, อื่น ๆ ต่อท้ายประเภทเดียวกัน
      const order = all.map((s) => s.key);
      const lastSameKind = [...all].reverse().find((s) => s.kind === kind);
      const at = lastSameKind ? order.indexOf(lastSameKind.key) + 1 : order.length;
      order.splice(at, 0, key);
      await resequence(a.db, order);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
  refreshAll();
  return { ok: true };
}

export async function moveStatus(key: string, dir: -1 | 1): Promise<StatusResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  try {
    const order = (await loadAll(a.db)).map((s) => s.key);
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return { ok: true };
    [order[i], order[j]] = [order[j], order[i]];
    await resequence(a.db, order);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
  refreshAll();
  return { ok: true };
}

export async function deleteStatus(key: string): Promise<StatusResult> {
  const a = await admin();
  if ("error" in a) return { error: a.error };
  const { data: cur } = await a.db.from("job_statuses").select("is_system, label").eq("key", key).maybeSingle();
  if (!cur) return { error: "ไม่พบสถานะ" };
  if (cur.is_system) return { error: "สถานะตั้งต้นของระบบลบไม่ได้ (ซ่อนได้)" };
  const { count } = await a.db.from("repair_jobs").select("id", { count: "exact", head: true }).eq("status", key);
  if (count) return { error: `ยังมีงานซ่อม ${count} งานอยู่ในสถานะ "${cur.label}" ย้ายงานไปสถานะอื่นก่อน หรือใช้ซ่อนแทน` };
  const { error } = await a.db.from("job_statuses").delete().eq("key", key);
  if (error) return { error: error.message };
  refreshAll();
  return { ok: true };
}
