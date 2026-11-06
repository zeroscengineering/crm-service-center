import { NextResponse, type NextRequest } from "next/server";
import { apiAuth } from "@/lib/api-auth";
import { removeConnection } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await apiAuth(true);
  if ("res" in auth) return auth.res;
  await removeConnection();
  return NextResponse.redirect(new URL("/settings?drive=disconnected", req.url), { status: 303 });
}
