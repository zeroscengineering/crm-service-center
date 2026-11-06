import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** ตรวจสิทธิ์ใน Route Handler — คืน supabase client หรือ response error */
export async function apiAuth(requireAdmin: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { res: NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) } as const;

  if (requireAdmin) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (data?.role !== "admin") {
      return { res: NextResponse.json({ error: "เฉพาะแอดมินเท่านั้นที่แก้ไขข้อมูลได้" }, { status: 403 }) } as const;
    }
  }
  return { supabase, user } as const;
}
