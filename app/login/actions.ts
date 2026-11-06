"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: "ระบบยังไม่ได้ตั้งค่า Supabase (ตรวจ Environment Variables ใน Vercel)" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("[login]", error.code, error.message);
      if (error.code === "email_not_confirmed") return { error: "บัญชีนี้ยังไม่ได้ยืนยันอีเมล" };
      if (error.code === "invalid_credentials") return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
      if (error.status === 401 || /api key/i.test(error.message)) {
        return { error: "คีย์ Supabase ไม่ถูกต้อง (ตรวจ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน Vercel)" };
      }
      return { error: `เข้าสู่ระบบไม่สำเร็จ: ${error.message}` };
    }
  } catch (e) {
    console.error("[login] connection", e);
    return { error: "เชื่อมต่อ Supabase ไม่ได้ (ตรวจ NEXT_PUBLIC_SUPABASE_URL ใน Vercel)" };
  }

  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}
