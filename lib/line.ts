/**
 * LINE Messaging API (ฝั่ง server เท่านั้น)
 * ค่าตั้งค่าเก็บในตาราง app_settings (key = "line") — กรอกผ่านหน้า ตั้งค่า
 */
import { createHmac, timingSafeEqual } from "crypto";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { getSetting, setSetting } from "@/lib/settings";
import { STATUS_LABEL, type RepairStatus } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

const API = "https://api.line.me/v2/bot";
const SETTING_KEY = "line";

export type LineConfig = {
  access_token: string;
  channel_secret: string;
  mode: "mock" | "live";
  /** สถานะที่ส่งแจ้งเตือนอัตโนมัติเมื่อเปลี่ยนสถานะ */
  auto_statuses: RepairStatus[];
  /** ส่งต่อ webhook ไปยังระบบเดิม (เช่น บอทค้นหาสถานะที่มีอยู่) */
  forward_url?: string;
  /** ตอบกลับลูกค้าเมื่อผูกบัญชีสำเร็จ (ปิดได้ถ้าระบบเดิมตอบอยู่แล้ว) */
  reply_on_link: boolean;
  updated_at?: string;
};

export const DEFAULT_LINE_CONFIG: LineConfig = {
  access_token: "",
  channel_secret: "",
  mode: "mock",
  auto_statuses: ["quoting", "ready"],
  forward_url: "",
  reply_on_link: true,
};

let cache: { value: LineConfig | null; at: number } | null = null;

export async function getLineConfig(): Promise<LineConfig | null> {
  if (!adminConfigured()) return null;
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const raw = await getSetting<LineConfig>(SETTING_KEY).catch(() => null);
  const value = raw ? { ...DEFAULT_LINE_CONFIG, ...raw } : null;
  cache = { value, at: Date.now() };
  return value;
}

export async function saveLineConfig(cfg: LineConfig) {
  await setSetting(SETTING_KEY, { ...cfg, updated_at: new Date().toISOString() });
  cache = null;
}

export function lineReady(cfg: LineConfig | null): cfg is LineConfig {
  return Boolean(cfg?.access_token && cfg.channel_secret);
}

// ---------- API ----------
async function lineFetch(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {}
    throw new Error(`LINE API ${res.status}: ${msg.slice(0, 200)}`);
  }
  return res;
}

export type BotInfo = { basicId: string; displayName: string; pictureUrl?: string; premiumId?: string };

const botCache = new Map<string, { v: BotInfo; at: number }>();
export async function getBotInfo(token: string): Promise<BotInfo> {
  const hit = botCache.get(token);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.v;
  const v = (await (await lineFetch(token, "/info")).json()) as BotInfo;
  botCache.set(token, { v, at: Date.now() });
  return v;
}

export async function getQuota(token: string) {
  const [q, c] = await Promise.all([
    lineFetch(token, "/message/quota").then((r) => r.json() as Promise<{ type: string; value?: number }>),
    lineFetch(token, "/message/quota/consumption").then((r) => r.json() as Promise<{ totalUsage: number }>),
  ]);
  return { limit: q.type === "limited" ? q.value ?? 0 : null, used: c.totalUsage };
}

export async function pushText(token: string, to: string, text: string) {
  await lineFetch(token, "/message/push", {
    method: "POST",
    body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
  });
}

export async function replyText(token: string, replyToken: string, text: string) {
  await lineFetch(token, "/message/reply", {
    method: "POST",
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
  });
}

export async function getProfile(token: string, userId: string) {
  const res = await lineFetch(token, `/profile/${encodeURIComponent(userId)}`);
  return (await res.json()) as { displayName?: string; pictureUrl?: string };
}

/** ดาวน์โหลดเนื้อไฟล์ที่ลูกค้าส่งมา (รูป ฯลฯ) — LINE เก็บไว้ชั่วคราวเท่านั้น */
export async function getContent(token: string, messageId: string) {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LINE content ${res.status}`);
  return res;
}

export function verifySignature(secret: string, rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function addFriendUrl(basicId: string) {
  return `https://line.me/R/ti/p/${encodeURIComponent(basicId)}`;
}

// ---------- ข้อความสำเร็จรูป ----------
export type JobMessageContext = {
  doc_no: string;
  status: RepairStatus;
  customer_name: string;
  brand: string;
  model: string;
  quotation_price: number | null;
  grand_total: number;
  track_url: string;
};

export function buildStatusMessage(c: JobMessageContext) {
  const head = `เรียนคุณ${c.customer_name}\nงานซ่อมเลขที่ ${c.doc_no} (${c.brand} ${c.model})`;
  const foot = `\n\nติดตามสถานะ: ${c.track_url}`;
  const price = c.quotation_price ?? (c.grand_total > 0 ? c.grand_total : null);

  const body: Record<RepairStatus, string> = {
    received: "ทางร้านได้รับเครื่องของท่านเรียบร้อยแล้ว อยู่ระหว่างตรวจเช็กอาการ",
    quoting: price
      ? `ช่างตรวจเช็กแล้ว ราคาประเมินค่าซ่อม ${formatMoney(price)} บาท\nกรุณาตอบกลับ "ยืนยันซ่อม" หรือโทรแจ้งร้าน เพื่อให้ช่างดำเนินการต่อ`
      : "ช่างกำลังตรวจเช็กอาการและประเมินราคา/อะไหล่ ทางร้านจะแจ้งราคาให้ทราบเร็ว ๆ นี้",
    approved: "ได้รับการยืนยันซ่อมแล้ว ขอบคุณครับ/ค่ะ ช่างจะเริ่มดำเนินการโดยเร็ว",
    repairing: "ช่างกำลังดำเนินการซ่อมเครื่องของท่าน",
    ready: `ซ่อมเสร็จเรียบร้อยแล้ว พร้อมรับเครื่องได้ที่ร้าน${
      c.grand_total > 0 ? `\nยอดชำระ ${formatMoney(c.grand_total)} บาท` : ""
    }\nกรุณานำใบรับเครื่องมาด้วย`,
    delivered: "ส่งมอบเครื่องเรียบร้อยแล้ว ขอบคุณที่ใช้บริการครับ/ค่ะ ",
    cancelled: "งานซ่อมนี้ถูกยกเลิก กรุณาติดต่อร้านเพื่อรับเครื่องคืน",
  };
  return `${head}\n\n${body[c.status]}${c.status === "delivered" ? "" : foot}`;
}

// ---------- ส่งข้อความของงานซ่อม + บันทึก log ----------
export async function loadJobContext(jobId: string, siteUrl: string) {
  const db = createAdminClient();
  const { data: job } = await db
    .from("repair_jobs")
    .select("id, doc_no, status, quotation_price, customer_id, customers(name, line_user_id), tools(brand, model)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return null;
  const { data: tot } = await db.from("repair_job_totals").select("grand_total").eq("repair_job_id", jobId).maybeSingle();

  const j = job as unknown as {
    id: string;
    doc_no: string;
    status: RepairStatus;
    quotation_price: number | null;
    customer_id: string;
    customers: { name: string; line_user_id: string | null } | null;
    tools: { brand: string; model: string } | null;
  };
  const ctx: JobMessageContext = {
    doc_no: j.doc_no,
    status: j.status,
    customer_name: j.customers?.name ?? "",
    brand: j.tools?.brand ?? "",
    model: j.tools?.model ?? "",
    quotation_price: j.quotation_price === null ? null : Number(j.quotation_price),
    // ยอดจากใบเสนอราคา (quotation_price) ถ้าไม่มีรายการอะไหล่เดิม
    grand_total: Number(tot?.grand_total ?? 0) || (j.quotation_price === null ? 0 : Number(j.quotation_price)),
    track_url: `${siteUrl}/track?doc=${encodeURIComponent(j.doc_no)}`,
  };
  return { ctx, customerId: j.customer_id, lineUserId: j.customers?.line_user_id ?? null };
}

export type SendResult = { ok: boolean; mode: "mock" | "live"; error?: string };

export async function sendJobMessage(opts: {
  jobId: string;
  text: string;
  siteUrl: string;
  sentBy?: string | null;
}): Promise<SendResult> {
  const cfg = await getLineConfig();
  const mode = cfg?.mode ?? "mock";
  const loaded = await loadJobContext(opts.jobId, opts.siteUrl);
  if (!loaded) return { ok: false, mode, error: "ไม่พบงานซ่อม" };

  let ok = true;
  let error: string | undefined;

  if (mode === "live") {
    if (!lineReady(cfg)) {
      ok = false;
      error = "ยังไม่ได้ตั้งค่า LINE (Channel access token / secret)";
    } else if (!loaded.lineUserId) {
      ok = false;
      error = "ลูกค้ายังไม่ได้เชื่อม LINE (ให้ลูกค้าแอด LINE OA แล้วพิมพ์เลขที่เอกสาร)";
    } else {
      try {
        await pushText(cfg.access_token, loaded.lineUserId, opts.text);
      } catch (e) {
        ok = false;
        error = e instanceof Error ? e.message : "ส่งไม่สำเร็จ";
      }
    }
  }

  if (mode === "live" && loaded.lineUserId) {
    const { recordOutbound } = await import("@/lib/chat");
    await recordOutbound({
      lineUserId: loaded.lineUserId,
      text: opts.text,
      status: ok ? "sent" : "failed",
      error,
      sentBy: opts.sentBy ?? null,
    }).catch((e) => console.error("[chat log]", e));
  }

  await createAdminClient()
    .from("line_messages")
    .insert({
      repair_job_id: opts.jobId,
      customer_id: loaded.customerId,
      message: opts.text,
      mode,
      success: ok,
      error: error ?? null,
      sent_by: opts.sentBy ?? null,
    });

  return { ok, mode, error };
}

/** เรียกหลังเปลี่ยนสถานะ — ส่งอัตโนมัติถ้าเปิดไว้ (ไม่ throw) */
export async function autoNotifyStatus(jobId: string, status: RepairStatus, siteUrl: string, sentBy?: string) {
  try {
    const cfg = await getLineConfig();
    if (!cfg || !cfg.auto_statuses.includes(status)) return null;
    const loaded = await loadJobContext(jobId, siteUrl);
    if (!loaded) return null;
    // โหมดจริง: ข้ามถ้าลูกค้ายังไม่เชื่อม LINE (ไม่ต้องบันทึก error ทุกครั้ง)
    if (cfg.mode === "live" && !loaded.lineUserId) return null;
    return await sendJobMessage({ jobId, text: buildStatusMessage(loaded.ctx), siteUrl, sentBy });
  } catch (e) {
    console.error("[line auto]", e);
    return null;
  }
}

export { STATUS_LABEL };
