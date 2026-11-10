/** นิยามสถานะงานซ่อม — ใช้ได้ทั้ง server และ client */
import { STATUS_LABEL, STATUSES } from "@/lib/constants";

export type StatusKind = "open" | "done" | "cancelled";

export type StatusDef = {
  key: string;
  label: string;
  color: string;
  sort: number;
  kind: StatusKind;
  is_system: boolean;
  hidden: boolean;
  line_message: string | null;
};

const DEFAULT_HEX: Record<string, string> = {
  received: "#64748B",
  quoting: "#D97706",
  approved: "#0284C7",
  repairing: "#4F46E5",
  ready: "#059669",
  delivered: "#71717A",
  cancelled: "#E11D48",
};

/** ค่าตั้งต้น (ใช้เมื่อยังไม่ได้รัน SQL 0010) */
export const DEFAULT_STATUSES: StatusDef[] = STATUSES.map((key, i) => ({
  key,
  label: STATUS_LABEL[key],
  color: DEFAULT_HEX[key],
  sort: (i + 1) * 10,
  kind: key === "delivered" ? "done" : key === "cancelled" ? "cancelled" : "open",
  is_system: true,
  hidden: false,
  line_message: null,
}));

/** ตัวช่วยอ่านสถานะ */
export function statusHelpers(list: StatusDef[]) {
  const sorted = [...list].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  const byKey = new Map(sorted.map((s) => [s.key, s]));
  const get = (key: string): StatusDef =>
    byKey.get(key) ?? { key, label: key.startsWith("c_") ? "(สถานะที่ลบแล้ว)" : key, color: "#64748B", sort: 999, kind: "open", is_system: false, hidden: false, line_message: null };
  /** ขั้นตอนบน Pipeline: ยังไม่ปิด + ปิดสำเร็จ (ไม่รวมยกเลิก และที่ซ่อนไว้) */
  const pipeline = sorted.filter((s) => s.kind !== "cancelled" && !s.hidden).map((s) => s.key);
  /** ใช้ในเมนูเลือกสถานะ (ไม่รวมที่ซ่อนไว้) */
  const selectable = sorted.filter((s) => !s.hidden).map((s) => s.key);
  const closedKeys = sorted.filter((s) => s.kind !== "open").map((s) => s.key);
  return {
    all: sorted,
    get,
    label: (key: string) => get(key).label,
    color: (key: string) => get(key).color,
    isOpen: (key: string) => get(key).kind === "open",
    isCancelled: (key: string) => get(key).kind === "cancelled",
    isDone: (key: string) => get(key).kind === "done",
    pipeline,
    selectable,
    closedKeys,
    /** สำหรับ PostgREST: .not("status","in", closedFilter) */
    closedFilter: `(${(closedKeys.length ? closedKeys : ["__none__"]).map((k) => `"${k}"`).join(",")})`,
  };
}
export type StatusHelpers = ReturnType<typeof statusHelpers>;

/** สีพื้นอ่อน/ขอบ จากสีหลัก (hex) */
export function badgeStyle(hex: string) {
  return { color: hex, backgroundColor: `${hex}14`, boxShadow: `inset 0 0 0 1px ${hex}55` };
}
