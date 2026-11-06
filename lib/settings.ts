import { createAdminClient } from "@/lib/supabase/admin";

export async function getSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await createAdminClient().from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าไม่ได้: ${error.message}`);
  return (data?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown) {
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`บันทึกการตั้งค่าไม่ได้: ${error.message}`);
}

export async function deleteSetting(key: string) {
  await createAdminClient().from("app_settings").delete().eq("key", key);
}
