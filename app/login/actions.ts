"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}
