/** เก็บเบอร์โทรเป็นตัวเลขล้วน */
export function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "");
}

/** 0812345678 -> 081-234-5678 */
export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "-";
  const d = normalizePhone(phone);
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return phone;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

export function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function todayBangkok() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/** ตัดอักขระที่ทำให้ filter ของ PostgREST พัง */
export function cleanSearch(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim().slice(0, 50);
}
