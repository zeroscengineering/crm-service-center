import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { apiAuth } from "@/lib/api-auth";
import { driveReady, jobFolder, uploadFile } from "@/lib/google-drive";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel จำกัด request ~4.5MB
const CATEGORIES = ["before", "after", "document"] as const;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await apiAuth(false);
  if ("res" in auth) return auth.res;
  const { supabase } = auth;

  if (!(await driveReady())) {
    return NextResponse.json({ error: "ยังไม่ได้เชื่อมต่อ Google Drive (ไปที่เมนู ตั้งค่า)" }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const category = String(form.get("category") ?? "before") as (typeof CATEGORIES)[number];

  if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: "ประเภทไฟล์ไม่ถูกต้อง" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 4MB" }, { status: 413 });
  if (!ALLOWED.test(file.type)) {
    return NextResponse.json({ error: "รองรับเฉพาะรูปภาพ (JPG/PNG/WEBP) และ PDF" }, { status: 415 });
  }

  const { data: job } = await supabase.from("repair_jobs").select("id, doc_no").eq("id", id).maybeSingle();
  if (!job) return NextResponse.json({ error: "ไม่พบงานซ่อม" }, { status: 404 });

  try {
    const folderId = await jobFolder(job.doc_no as string);
    const prefix = { before: "ก่อนซ่อม", after: "หลังซ่อม", document: "เอกสาร" }[category];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const drive = await uploadFile({
      folderId,
      name: `${prefix}_${stamp}_${file.name}`,
      mimeType: file.type,
      data: await file.arrayBuffer(),
    });

    const { data: row, error } = await supabase
      .from("repair_images")
      .insert({
        repair_job_id: id,
        category,
        drive_file_id: drive.id,
        image_url: drive.webViewLink,
        file_name: file.name,
        mime_type: file.type,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath(`/jobs/${id}`);
    return NextResponse.json({ image: row });
  } catch (e) {
    console.error("[drive upload]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ" }, { status: 502 });
  }
}
