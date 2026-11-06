"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";

export type UserResult = { ok?: boolean; error?: string };
type Role = "admin" | "technician";

async function guard() {
  const me = await requireProfile();
  if (me.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้นที่จัดการผู้ใช้งานได้" } as const;
  if (!adminConfigured()) return { error: "ยังไม่ได้ตั้ง SUPABASE_SERVICE_ROLE_KEY" } as const;
  return { me, db: createAdminClient() } as const;
}

function done() {
  revalidatePath("/settings");
  return { ok: true };
}

/** ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน */
async function otherActiveAdmins(db: ReturnType<typeof createAdminClient>, exceptId: string) {
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").neq("id", exceptId);
  if (!admins?.length) return 0;
  let n = 0;
  for (const a of admins) {
    const { data } = await db.auth.admin.getUserById(a.id as string);
    const bu = (data.user as { banned_until?: string | null } | null)?.banned_until;
    const banned = bu && new Date(bu) > new Date();
    if (data.user && !banned) n++;
  }
  return n;
}

export async function createStaff(_p: UserResult, fd: FormData): Promise<UserResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const fullName = String(fd.get("full_name") ?? "").trim();
  const role: Role = fd.get("role") === "admin" ? "admin" : "technician";

  if (!fullName) return { error: "กรุณากรอกชื่อ" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "อีเมลไม่ถูกต้อง" };
  if (password.length < 6) return { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" };

  const { data, error } = await g.db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    const msg = /already|registered|exists/i.test(error?.message ?? "") ? "อีเมลนี้มีผู้ใช้อยู่แล้ว" : error?.message;
    return { error: `สร้างผู้ใช้ไม่สำเร็จ: ${msg ?? ""}` };
  }
  // trigger สร้าง profile ให้แล้ว (ค่าเริ่มต้น = ช่าง) → ตั้งชื่อ/สิทธิ์ตามที่เลือก
  const { error: pErr } = await g.db
    .from("profiles")
    .upsert({ id: data.user.id, full_name: fullName, role }, { onConflict: "id" });
  if (pErr) return { error: `สร้างผู้ใช้แล้ว แต่ตั้งสิทธิ์ไม่สำเร็จ: ${pErr.message}` };
  return done();
}

export async function updateStaff(id: string, patch: { full_name?: string; role?: Role }): Promise<UserResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const row: Record<string, string> = {};
  if (patch.full_name !== undefined) {
    if (!patch.full_name.trim()) return { error: "ชื่อต้องไม่ว่าง" };
    row.full_name = patch.full_name.trim();
  }
  if (patch.role) {
    if (id === g.me.id && patch.role !== "admin") return { error: "ไม่สามารถลดสิทธิ์ของตัวเองได้" };
    if (patch.role !== "admin" && (await otherActiveAdmins(g.db, id)) === 0) {
      return { error: "ต้องมีแอดมินอย่างน้อย 1 คน" };
    }
    row.role = patch.role;
  }
  const { error } = await g.db.from("profiles").update(row).eq("id", id);
  if (error) return { error: error.message };
  // ชื่อช่างในงานซ่อมเดิมให้ตรงกับชื่อใหม่
  if (row.full_name) await g.db.from("repair_jobs").update({ technician_name: row.full_name }).eq("technician_id", id);
  return done();
}

export async function resetStaffPassword(id: string, password: string): Promise<UserResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  if (password.length < 6) return { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" };
  const { error } = await g.db.auth.admin.updateUserById(id, { password });
  if (error) return { error: error.message };
  return done();
}

export async function setStaffActive(id: string, active: boolean): Promise<UserResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  if (id === g.me.id && !active) return { error: "ไม่สามารถปิดบัญชีของตัวเองได้" };
  if (!active) {
    const { data: p } = await g.db.from("profiles").select("role").eq("id", id).maybeSingle();
    if (p?.role === "admin" && (await otherActiveAdmins(g.db, id)) === 0) return { error: "ต้องมีแอดมินอย่างน้อย 1 คน" };
  }
  // ปิดใช้งาน = แบนแบบไม่มีกำหนด (ไม่ลบ เพื่อให้ประวัติงานยังอ้างชื่อได้)
  const { error } = await g.db.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  if (error) return { error: error.message };
  return done();
}
