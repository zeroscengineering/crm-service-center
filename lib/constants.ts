export const BRANDS = ["Milwaukee", "Skil", "Workpro"] as const;
export type Brand = (typeof BRANDS)[number];

export const STATUSES = [
  "received",
  "quoting",
  "approved",
  "repairing",
  "ready",
  "delivered",
  "cancelled",
] as const;
export type RepairStatus = (typeof STATUSES)[number];

/** ขั้นตอนหลักที่แสดงบน Pipeline (ไม่รวมยกเลิก) */
export const PIPELINE: RepairStatus[] = [
  "received",
  "quoting",
  "approved",
  "repairing",
  "ready",
  "delivered",
];

export const STATUS_LABEL: Record<RepairStatus, string> = {
  received: "รับเรื่องซ่อม",
  quoting: "กำลังประเมินราคา/อะไหล่",
  approved: "ลูกค้าอนุมัติซ่อม",
  repairing: "กำลังซ่อม",
  ready: "ซ่อมเสร็จพร้อมส่งคืน",
  delivered: "ส่งมอบเรียบร้อย",
  cancelled: "ยกเลิก",
};

export const STATUS_COLOR: Record<RepairStatus, string> = {
  received: "bg-slate-100 text-slate-700 ring-slate-300",
  quoting: "bg-amber-50 text-amber-800 ring-amber-300",
  approved: "bg-sky-50 text-sky-800 ring-sky-300",
  repairing: "bg-indigo-50 text-indigo-800 ring-indigo-300",
  ready: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  delivered: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-300",
};

export const WARRANTY_LABEL = {
  in_warranty: "ในประกัน",
  out_of_warranty: "นอกประกัน",
  unknown: "ยังไม่ตรวจสอบ",
} as const;

export const ACCESSORY_OPTIONS = ["แบตเตอรี่", "ที่ชาร์จ", "กล่อง/กระเป๋า", "ดอกสว่าน/ใบมีด", "สายไฟ"];
export const DOCUMENT_OPTIONS = ["ใบเสร็จ/ใบกำกับภาษี", "บัตรรับประกัน", "ใบส่งของ", "ใบแจ้งซ่อมจากร้านค้า"];

/** ข้อมูลร้านบนใบรับเครื่อง — แก้ได้ตามจริง */
export const SHOP = {
  name: "CRM-SERVICE CENTER",
  subtitle: "ศูนย์บริการซ่อมเครื่องมือช่าง Milwaukee · Skil · Workpro",
  address: "",
  phone: "",
  terms: [
    "กรุณานำใบรับเครื่องนี้มาแสดงเมื่อรับสินค้าคืน",
    "ทางร้านจะแจ้งราคาประเมินก่อนดำเนินการซ่อมทุกครั้ง",
    "สินค้าที่ซ่อมเสร็จแล้ว กรุณามารับภายใน 30 วันนับจากวันที่แจ้ง",
  ],
};
