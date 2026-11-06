"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

export type SaveState = { error?: string; ok?: boolean };

export async function updateCustomer(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireStaff();
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const phone = normalizePhone(String(fd.get("phone") ?? ""));
  if (!name) return { error: "กรุณากรอกชื่อ" };
  if (phone.length < 9) return { error: "เบอร์โทรไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name,
      phone,
      line_id: String(fd.get("line_id") ?? "").trim() || null,
      address: String(fd.get("address") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function unlinkLine(customerId: string): Promise<SaveState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ line_user_id: null }).eq("id", customerId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
