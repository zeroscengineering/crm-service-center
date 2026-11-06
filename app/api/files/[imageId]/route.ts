import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { apiAuth } from "@/lib/api-auth";
import { deleteFile, downloadFile, driveReady } from "@/lib/google-drive";

export const runtime = "nodejs";

/** แสดงไฟล์จาก Drive ผ่านเซิร์ฟเวอร์ (เฉพาะพนักงานที่ล็อกอิน — ไฟล์ใน Drive ไม่เปิดสาธารณะ) */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  const auth = await apiAuth(false);
  if ("res" in auth) return auth.res;

  const { data: img } = await auth.supabase
    .from("repair_images")
    .select("drive_file_id, mime_type, file_name")
    .eq("id", imageId)
    .maybeSingle();
  if (!img) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
  if (!(await driveReady())) return NextResponse.json({ error: "ยังไม่ได้เชื่อมต่อ Google Drive" }, { status: 503 });

  try {
    const res = await downloadFile(img.drive_file_id as string);
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": (img.mime_type as string) || res.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent((img.file_name as string) || "file")}`,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    console.error("[drive download]", e);
    return NextResponse.json({ error: "โหลดไฟล์จาก Google Drive ไม่ได้" }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  const auth = await apiAuth(true);
  if ("res" in auth) return auth.res;

  const { data: img } = await auth.supabase
    .from("repair_images")
    .select("id, drive_file_id, repair_job_id")
    .eq("id", imageId)
    .maybeSingle();
  if (!img) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });

  try {
    if (await driveReady()) await deleteFile(img.drive_file_id as string);
  } catch (e) {
    console.error("[drive delete]", e);
    return NextResponse.json({ error: "ลบไฟล์ใน Google Drive ไม่สำเร็จ" }, { status: 502 });
  }

  const { error } = await auth.supabase.from("repair_images").delete().eq("id", imageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath(`/jobs/${img.repair_job_id}`);
  return NextResponse.json({ ok: true });
}
