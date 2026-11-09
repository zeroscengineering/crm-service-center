import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/api-auth";
import { isValidTin, lookupVat } from "@/lib/rd-vat";

export const dynamic = "force-dynamic";

/** GET /api/tax-lookup?tin=0105559044775 — พนักงานที่ล็อกอินแล้วเท่านั้น */
export async function GET(req: Request) {
  const a = await apiAuth(false);
  if ("res" in a) return a.res;
  const tin = new URL(req.url).searchParams.get("tin")?.replace(/\D/g, "") ?? "";
  if (tin.length !== 13) return NextResponse.json({ error: "เลขผู้เสียภาษีต้องมี 13 หลัก" }, { status: 400 });
  if (!isValidTin(tin)) return NextResponse.json({ error: "เลขผู้เสียภาษีไม่ถูกต้อง (หลักตรวจสอบไม่ตรง)" }, { status: 400 });
  const r = await lookupVat(tin);
  if ("error" in r) return NextResponse.json(r, { status: 404 });
  return NextResponse.json(r);
}
