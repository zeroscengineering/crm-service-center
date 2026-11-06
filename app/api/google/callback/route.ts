import { NextResponse, type NextRequest } from "next/server";
import { apiAuth } from "@/lib/api-auth";
import { exchangeCode, getAbout, saveConnection, rootFolder } from "@/lib/google-drive";
import { siteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const r = NextResponse.redirect(new URL(`/settings?${q}`, req.url));
    r.cookies.delete({ name: "g_oauth_state", path: "/api/google" });
    return r;
  };

  const auth = await apiAuth(true);
  if ("res" in auth) return auth.res;

  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back(`drive_error=${encodeURIComponent(sp.get("error")!)}`);

  const state = sp.get("state");
  const code = sp.get("code");
  if (!code || !state || state !== req.cookies.get("g_oauth_state")?.value) {
    return back("drive_error=state_mismatch");
  }

  try {
    const redirectUri = `${await siteUrl()}/api/google/callback`;
    const tokens = await exchangeCode(code, redirectUri);

    if (!tokens.scope?.includes("drive.file")) return back("drive_error=scope_denied");
    if (!tokens.refresh_token) return back("drive_error=no_refresh_token");

    const about = await getAbout(tokens.access_token);
    await saveConnection({
      refresh_token: tokens.refresh_token,
      email: about.user?.emailAddress ?? "",
      name: about.user?.displayName,
      connected_at: new Date().toISOString(),
      connected_by: auth.user.email ?? auth.user.id,
    });
    await rootFolder(); // สร้างโฟลเดอร์หลักไว้เลย
    return back("drive=connected");
  } catch (e) {
    console.error("[google callback]", e);
    return back(`drive_error=${encodeURIComponent(e instanceof Error ? e.message : "unknown")}`);
  }
}
