/** แชท LINE — บันทึกข้อความเข้า/ออก (ฝั่ง server, ใช้ service_role) */
import { createAdminClient } from "@/lib/supabase/admin";
import { getContent, getProfile } from "@/lib/line";
import { chatFolder, driveReady, uploadFile } from "@/lib/google-drive";

export type InboundEvent = {
  type: string;
  timestamp?: number;
  source?: { type: string; userId?: string };
  message?: { id: string; type: string; text?: string; fileName?: string; packageId?: string; stickerId?: string };
};

const TYPE_LABEL: Record<string, string> = {
  image: "รูปภาพ",
  video: "วิดีโอ",
  audio: "ข้อความเสียง",
  file: "ไฟล์",
  location: "ตำแหน่ง",
  sticker: "สติกเกอร์",
};

export function previewText(type: string, text: string | null | undefined) {
  return type === "text" ? (text ?? "") : TYPE_LABEL[type] ?? `[${type}]`;
}

/** สร้าง/อัปเดตผู้ติดต่อ (ดึงชื่อ LINE ถ้ายังไม่มี) */
export async function ensureContact(token: string, userId: string) {
  const db = createAdminClient();
  const { data } = await db.from("line_contacts").select("line_user_id, display_name").eq("line_user_id", userId).maybeSingle();
  if (data?.display_name) return;
  let display_name: string | null = null;
  let picture_url: string | null = null;
  try {
    const p = await getProfile(token, userId);
    display_name = p.displayName ?? null;
    picture_url = p.pictureUrl ?? null;
  } catch {}
  // ผูกลูกค้าอัตโนมัติ ถ้าเคยเชื่อม LINE ไว้แล้ว
  const { data: cust } = await db.from("customers").select("id").eq("line_user_id", userId).maybeSingle();
  await db.from("line_contacts").upsert(
    {
      line_user_id: userId,
      display_name,
      picture_url,
      ...(cust ? { customer_id: cust.id } : {}),
    },
    { onConflict: "line_user_id" },
  );
}

async function touchContact(userId: string, text: string, at: string, incoming: boolean) {
  const db = createAdminClient();
  const { data } = await db.from("line_contacts").select("unread_count").eq("line_user_id", userId).maybeSingle();
  await db
    .from("line_contacts")
    .update({
      last_message_at: at,
      last_message_text: text.slice(0, 200),
      ...(incoming ? { unread_count: (data?.unread_count ?? 0) + 1 } : {}),
    })
    .eq("line_user_id", userId);
}

/** บันทึกข้อความที่ลูกค้าส่งเข้ามา — รูปภาพจะถูกบันทึกลง Google Drive */
export async function recordInbound(token: string, ev: InboundEvent) {
  const userId = ev.source?.userId;
  const m = ev.message;
  if (!userId || !m || ev.source?.type !== "user") return;

  await ensureContact(token, userId);

  let driveFileId: string | null = null;
  if (m.type === "image" && (await driveReady())) {
    try {
      const res = await getContent(token, m.id);
      const mime = res.headers.get("content-type") ?? "image/jpeg";
      const ext = mime.includes("png") ? "png" : "jpg";
      const file = await uploadFile({
        folderId: await chatFolder(),
        name: `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}_${userId.slice(-6)}.${ext}`,
        mimeType: mime,
        data: await res.arrayBuffer(),
      });
      driveFileId = file.id;
    } catch (e) {
      console.error("[chat image]", e);
    }
  }

  const at = ev.timestamp ? new Date(ev.timestamp).toISOString() : new Date().toISOString();
  const text = m.type === "text" ? m.text ?? "" : m.type === "file" ? m.fileName ?? null : null;

  await createAdminClient().from("chat_messages").insert({
    line_user_id: userId,
    direction: "in",
    msg_type: m.type,
    text,
    line_message_id: m.id,
    drive_file_id: driveFileId,
    created_at: at,
  });
  await touchContact(userId, previewText(m.type, text), at, true);
}

export async function recordOutbound(opts: {
  lineUserId: string;
  text: string;
  status: "sent" | "mock" | "failed";
  error?: string | null;
  sentBy?: string | null;
}) {
  const db = createAdminClient();
  await db.from("line_contacts").upsert({ line_user_id: opts.lineUserId }, { onConflict: "line_user_id", ignoreDuplicates: true });
  await db.from("chat_messages").insert({
    line_user_id: opts.lineUserId,
    direction: "out",
    msg_type: "text",
    text: opts.text,
    status: opts.status,
    error: opts.error ?? null,
    sent_by: opts.sentBy ?? null,
  });
  if (opts.status !== "failed") await touchContact(opts.lineUserId, opts.text, new Date().toISOString(), false);
}

/** ผูกผู้ติดต่อ LINE กับลูกค้า (และให้ลูกค้าคนนั้นรับแจ้งเตือนงานซ่อมได้) */
export async function linkContact(userId: string, customerId: string | null) {
  const db = createAdminClient();
  await db.from("line_contacts").update({ customer_id: customerId }).eq("line_user_id", userId);
  if (customerId) {
    // ยกเลิกการผูกเดิมของ LINE นี้กับลูกค้าคนอื่น แล้วผูกกับคนใหม่
    await db.from("customers").update({ line_user_id: null }).eq("line_user_id", userId).neq("id", customerId);
    await db.from("customers").update({ line_user_id: userId }).eq("id", customerId);
  } else {
    await db.from("customers").update({ line_user_id: null }).eq("line_user_id", userId);
  }
}

export async function markRead(userId: string) {
  await createAdminClient().from("line_contacts").update({ unread_count: 0 }).eq("line_user_id", userId).gt("unread_count", 0);
}
