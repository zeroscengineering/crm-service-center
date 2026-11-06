"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { adminConfigured } from "@/lib/supabase/admin";
import { getLineConfig, lineReady, pushText } from "@/lib/line";
import { linkContact, recordOutbound } from "@/lib/chat";

export type ChatResult = { ok?: boolean; error?: string; info?: string };

async function guard() {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้นที่ตอบแชทได้" } as const;
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

// ---------- แท็ก ----------
const TAG_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

export async function createTag(name: string, lineUserId?: string): Promise<ChatResult & { id?: string }> {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้น" };
  const n = name.trim().slice(0, 40);
  if (!n) return { error: "กรุณาพิมพ์ชื่อแท็ก" };
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  const { data, error } = await db.from("tags").upsert({ name: n, color }, { onConflict: "name", ignoreDuplicates: false }).select("id").single();
  if (error || !data) return { error: error?.message ?? "สร้างแท็กไม่ได้" };
  if (lineUserId) await db.from("contact_tags").upsert({ line_user_id: lineUserId, tag_id: data.id }, { ignoreDuplicates: true });
  revalidatePath("/chat");
  return { ok: true, id: data.id as string };
}

export async function toggleContactTag(lineUserId: string, tagId: string, on: boolean): Promise<ChatResult> {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้น" };
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const { error } = on
    ? await db.from("contact_tags").upsert({ line_user_id: lineUserId, tag_id: tagId }, { ignoreDuplicates: true })
    : await db.from("contact_tags").delete().eq("line_user_id", lineUserId).eq("tag_id", tagId);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteTag(tagId: string): Promise<ChatResult> {
  const p = await requireProfile();
  if (p.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้น" };
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const { error } = await db.from("tags").delete().eq("id", tagId);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}
