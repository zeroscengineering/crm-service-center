import { NextResponse, type NextRequest } from "next/server";
import { runBackup } from "@/lib/backup";
import { driveReady } from "@/lib/google-drive";

export const runtime = "nodejs";
export const maxDuration = 60;

/** เรียกโดย Vercel Cron ทุกคืน (ดู vercel.json) — ต้องตั้ง CRON_SECRET ใน Vercel */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await driveReady())) return NextResponse.json({ skipped: "drive not connected" });

  try {
    const info = await runBackup("auto");
    return NextResponse.json({ ok: true, at: info.at });
  } catch (e) {
    console.error("[cron backup]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
