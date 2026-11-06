import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLineConfig, lineReady, replyText, verifySignature } from "@/lib/line";
import { STATUS_LABEL, type RepairStatus } from "@/lib/constants";
import { siteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const maxDuration = 30;

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
};

/** ส่งต่อ webhook ให้ระบบเดิม (คง body + ลายเซ็นเดิม เพื่อให้ระบบเดิมตรวจสอบได้ตามปกติ) */
async function forward(url: string, raw: string, signature: string | null) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(signature ? { "x-line-signature": signature } : {}) },
      body: raw,
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[line forward]", e);
  }
}

async function handleLink(ev: LineEvent, token: string, canReply: boolean, base: string) {
  const userId = ev.source?.userId;
  const text = ev.message?.text?.trim().toUpperCase();
  if (!userId || !text || ev.source?.type !== "user") return;

  if (text.length > 60) return;
  const db = createAdminClient();
  const select = "id, doc_no, status, customer_id, customers(id, phone, line_user_id)";

  // 1) ทั้งข้อความคือเลขที่เอกสาร (รองรับเลขที่มีช่องว่าง เช่น "TEST 1")
  // 2) หรือ "เลขที่เอกสาร + เบอร์ 4 ตัวท้าย"
  let last4: string | undefined;
  let { data: job } = await db.from("repair_jobs").select(select).eq("doc_no", text).maybeSingle();
  if (!job) {
    const m = text.match(/^(.+?)\s+(\d{4})$/);
    if (m) {
      last4 = m[2];
      ({ data: job } = await db.from("repair_jobs").select(select).eq("doc_no", m[1]).maybeSingle());
    }
  }
  if (!job) return; // ไม่ใช่เลขที่เอกสาร — ปล่อยให้ระบบเดิมจัดการ

  const j = job as unknown as {
    doc_no: string;
    status: RepairStatus;
    customers: { id: string; phone: string; line_user_id: string | null } | null;
  };
  const c = j.customers;
  if (!c) return;

  const say = async (msg: string) => {
    if (canReply && ev.replyToken) await replyText(token, ev.replyToken, msg).catch((e) => console.error("[line reply]", e));
  };

  if (c.line_user_id && c.line_user_id !== userId) {
    // ป้องกันคนอื่นแอบผูก: ต้องยืนยันด้วยเบอร์โทร 4 ตัวท้าย
    if (!last4 || !/^\d{4}$/.test(last4) || !c.phone.endsWith(last4)) {
      await say(
        `เลขที่เอกสาร ${j.doc_no} เชื่อมกับบัญชี LINE อื่นอยู่แล้ว\nหากต้องการเปลี่ยน กรุณาพิมพ์: ${j.doc_no} ตามด้วยเบอร์โทร 4 ตัวท้าย\nเช่น ${j.doc_no} 5678`,
      );
      return;
    }
  }

  if (c.line_user_id !== userId) {
    await db.from("customers").update({ line_user_id: userId }).eq("id", c.id);
  }
  await say(
    `✅ เชื่อมการแจ้งเตือนเรียบร้อย\nงานซ่อมเลขที่ ${j.doc_no}\nสถานะปัจจุบัน: ${STATUS_LABEL[j.status]}\n\nทางร้านจะแจ้งความคืบหน้าทาง LINE นี้\nติดตามสถานะ: ${base}/track?doc=${encodeURIComponent(j.doc_no)}`,
  );
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-line-signature");
  const cfg = await getLineConfig();

  if (!lineReady(cfg)) return NextResponse.json({ ok: true, note: "line not configured" });
  if (!verifySignature(cfg.channel_secret, raw, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const base = await siteUrl();
  const tasks: Promise<unknown>[] = [];
  if (cfg.forward_url) tasks.push(forward(cfg.forward_url, raw, signature));

  for (const ev of events) {
    if (ev.type === "message" && ev.message?.type === "text") {
      tasks.push(handleLink(ev, cfg.access_token, cfg.reply_on_link, base));
    } else if (ev.type === "follow" && cfg.reply_on_link && !cfg.forward_url && ev.replyToken) {
      tasks.push(
        replyText(
          cfg.access_token,
          ev.replyToken,
          "ขอบคุณที่เพิ่มเพื่อน 🙏\nพิมพ์ “เลขที่เอกสาร” จากใบรับเครื่อง เพื่อรับแจ้งเตือนสถานะการซ่อมทาง LINE",
        ).catch(() => undefined),
      );
    }
  }

  await Promise.allSettled(tasks);
  return NextResponse.json({ ok: true });
}
