import { NextResponse, type NextRequest } from "next/server";
import { apiAuth } from "@/lib/api-auth";
import { authUrl, driveClientConfigured } from "@/lib/google-drive";
import { siteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await apiAuth(true);
  if ("res" in auth) return auth.res;

  if (!driveClientConfigured()) {
    return NextResponse.redirect(new URL("/settings?drive_error=not_configured", req.url));
  }

  const state = crypto.randomUUID();
  const redirectUri = `${await siteUrl()}/api/google/callback`;
  const res = NextResponse.redirect(authUrl(redirectUri, state));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
