export const DOC_PREFIX = "SV";

/** คำนำหน้าเลขที่เดือนนี้ เช่น SV2611- (ปี ค.ศ. 2 หลัก + เดือน ตามเวลาไทย) */
export function docPrefix(date = new Date()) {
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "2-digit", month: "2-digit" })
    .format(date)
    .replace(/\D/g, "");
  return `${DOC_PREFIX}${ym}-`;
}

/** เลขที่เอกสารถัดไป เช่น SV2611-0007 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function nextDocNo(db: { from: (table: string) => any }, offset = 0) {
  const prefix = docPrefix();
  const { data } = await db
    .from("repair_jobs")
    .select("doc_no")
    .like("doc_no", `${prefix}%`)
    .order("doc_no", { ascending: false })
    .limit(1);
  const last = data?.[0]?.doc_no as string | undefined;
  const n = last ? Number(last.slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(n) ? n : 0) + 1 + offset).padStart(4, "0")}`;
}
