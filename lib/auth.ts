import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "technician";
};

/**
 * ผู้ใช้ปัจจุบัน + profile — cache ต่อ 1 request
 * (layout + page + action เรียกซ้ำได้โดยไม่ยิงฐานข้อมูลซ้ำ)
 */
const loadProfile = cache(async (): Promise<(Profile & { email: string }) | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data } = await supabase.from("profiles").select("id, full_name, role").eq("id", claims.sub).single();
  const email = (claims.email as string | undefined) ?? "";
  return {
    id: claims.sub,
    email,
    full_name: data?.full_name ?? email,
    role: (data?.role as Profile["role"]) ?? "technician",
  };
});

/** ถ้าไม่ได้ล็อกอินจะ redirect ไป /login */
export async function requireProfile(): Promise<Profile & { email: string }> {
  const p = await loadProfile();
  if (!p) redirect("/login");
  return p;
}

/** ใช้ใน Server Action ที่แก้ไขข้อมูล — ช่างจะถูกปฏิเสธ */
export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    throw new Error("เฉพาะแอดมินเท่านั้นที่แก้ไขข้อมูลได้");
  }
  return profile;
}
