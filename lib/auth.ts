import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "technician";
};

/** ดึงผู้ใช้ปัจจุบัน + profile; ถ้าไม่ได้ล็อกอินจะ redirect ไป /login */
export async function requireProfile(): Promise<Profile & { email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: data?.full_name ?? user.email ?? "",
    role: (data?.role as Profile["role"]) ?? "technician",
  };
}

/** ใช้ใน Server Action ที่แก้ไขข้อมูล — ช่างจะถูกปฏิเสธ */
export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    throw new Error("เฉพาะแอดมินเท่านั้นที่แก้ไขข้อมูลได้");
  }
  return profile;
}
