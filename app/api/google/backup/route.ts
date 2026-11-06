import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiAuth } from "@/lib/api-auth";
import { runBackup } from "@/lib/backup";
import { driveReady } from "@/lib/google-drive";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const auth = await apiAuth(true);
  if ("res" in auth) return auth.res;
  if (!(await driveReady())) return NextResponse.json({ error: "ยังไม่ได้เชื่อมต่อ Google Drive" }, { status: 503 });

  try {
    const info = await runBackup("manual");
    revalidatePath("/settings");
    return NextResponse.json({ ok: true, info });
  } catch (e) {
    console.error("[backup]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "สำรองข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
