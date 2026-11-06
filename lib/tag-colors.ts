/** สีแท็กสำเร็จรูป (ตัวอักษรสีขาวอ่านได้ทุกสี) */
export const TAG_PALETTE = [
  "#D7261E", // แดง
  "#EA580C", // ส้ม
  "#D97706", // เหลืองอำพัน
  "#16A34A", // เขียว
  "#0D9488", // เขียวน้ำทะเล
  "#0891B2", // ฟ้า
  "#2563EB", // น้ำเงิน
  "#7C3AED", // ม่วง
  "#DB2777", // ชมพู
  "#92400E", // น้ำตาล
  "#475569", // เทา
  "#1F2328", // ดำ
] as const;

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function randomTagColor() {
  return TAG_PALETTE[Math.floor(Math.random() * TAG_PALETTE.length)];
}
