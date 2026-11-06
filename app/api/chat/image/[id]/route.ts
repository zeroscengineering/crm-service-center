import { NextResponse, type NextRequest } from "next/server";
import { apiAuth } from "@/lib/api-auth";
import { downloadFile, driveReady } from "@/lib/google-drive";
import { getContent, getLineConfig, lineReady } from "@/lib/line";

export const runtime = "nodejs";

/** แสดงรูปจากแชท: จาก Google Drive (ถ้าบันทึกไว้) หรือดึงจาก LINE โดยตรง */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await apiAuth(false);
  if ("res" in auth) return auth.res;

  const { data: msg } = await auth.supabase
    .from("chat_messages")
    .select("drive_file_id, line_message_id")
    .eq("id", id)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    let res: Response;
    if (msg.drive_file_id && (await driveReady())) {
      res = await downloadFile(msg.drive_file_id as string);
    } else {
      const cfg = await getLineConfig();
      if (!lineReady(cfg) || !msg.line_message_id) throw new Error("no source");
      res = await getContent(cfg.access_token, msg.line_message_id as string);
    }
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "รูปนี้หมดอายุหรือโหลดไม่ได้" }, { status: 404 });
  }
}
