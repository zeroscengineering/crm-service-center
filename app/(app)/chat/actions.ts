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
