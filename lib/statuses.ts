import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_STATUSES, statusHelpers, type StatusDef } from "@/lib/status-def";

/** อ่านรายการสถานะจากตาราง job_statuses (ครั้งเดียวต่อ request) — ยังไม่รัน SQL 0010 = ใช้ค่าตั้งต้น */
export const getStatusList = cache(async (): Promise<StatusDef[]> => {
  try {
    const db = await createClient();
    const { data, error } = await db.from("job_statuses").select("*").order("sort");
    if (error || !data?.length) return DEFAULT_STATUSES;
    return data as unknown as StatusDef[];
  } catch {
    return DEFAULT_STATUSES;
  }
});

export async function getStatuses() {
  return statusHelpers(await getStatusList());
}
