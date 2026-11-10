"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { adminConfigured } from "@/lib/supabase/admin";
import { DEFAULT_LINE_CONFIG, getBotInfo, getLineConfig, saveLineConfig, type LineConfig } from "@/lib/line";
import type { RepairStatus } from "@/lib/constants";
import { getStatuses } from "@/lib/statuses";

export type LineSaveState = { ok?: boolean; error?: string; info?: string };

export async function saveLineSettings(_prev: LineSaveState, fd: FormData): Promise<LineSaveState> {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { error: "เฉพาะแอดมินเท่านั้น" };
  if (!adminConfigured()) return { error: "ยังไม่ได้ตั้ง SUPABASE_SERVICE_ROLE_KEY ใน Vercel" };

  const current = (await getLineConfig()) ?? DEFAULT_LINE_CONFIG;
  // ช่องคีย์เว้นว่าง = ใช้ค่าเดิม (ไม่แสดงคีย์เดิมในฟอร์มเพื่อความปลอดภัย)
  const token = String(fd.get("access_token") ?? "").trim() || current.access_token;
  const secret = String(fd.get("channel_secret") ?? "").trim() || current.channel_secret;
  const forward = String(fd.get("forward_url") ?? "").trim();

  if (forward && !/^https:\/\/.+/i.test(forward)) return { error: "Webhook URL ของระบบเดิมต้องขึ้นต้นด้วย https://" };
  if (forward.includes("/api/line/webhook") && forward.includes("crm-service-center")) {
    return { error: "ห้ามใส่ Webhook ของระบบนี้เอง (จะวนซ้ำไม่จบ)" };
  }

  const st = await getStatuses();
  const auto = fd
    .getAll("auto_statuses")
    .map(String)
    .filter((s): s is RepairStatus => st.all.some((x) => x.key === s));

  const cfg: LineConfig = {
    access_token: token,
    channel_secret: secret,
    mode: fd.get("mode") === "live" ? "live" : "mock",
    auto_statuses: auto,
    forward_url: forward,
    reply_on_link: fd.get("reply_on_link") === "on",
  };

  let info: string | undefined;
  if (cfg.access_token) {
    try {
      const bot = await getBotInfo(cfg.access_token);
      info = `เชื่อมต่อบัญชี LINE OA “${bot.displayName}” (${bot.basicId}) สำเร็จ`;
    } catch (e) {
      return { error: `Channel access token ใช้ไม่ได้: ${e instanceof Error ? e.message : ""}` };
    }
  }
  if (cfg.mode === "live" && (!cfg.access_token || !cfg.channel_secret)) {
    return { error: "โหมดส่งจริงต้องใส่ทั้ง Channel access token และ Channel secret" };
  }

  await saveLineConfig(cfg);
  revalidatePath("/settings");
  return { ok: true, info };
}
