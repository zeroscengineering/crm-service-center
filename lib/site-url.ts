import { headers } from "next/headers";

/** URL ของเว็บไซต์ปัจจุบัน (ใช้สร้างลิงก์ใน QR) */
export async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
