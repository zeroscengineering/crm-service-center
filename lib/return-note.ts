/** ใบส่งคืนสินค้าชั่วคราว — ชนิดข้อมูลและค่าคงที่ (ใช้ได้ทั้ง server และ client) */
export type ReturnItem = {
  job_id: string | null;
  doc_no: string;
  description: string;
  serial_no: string;
  qty: number;
  unit: string;
  remark: string;
};

export type ReturnStatus = "issued" | "returned" | "cancelled";
export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  issued: "ออกใบแล้ว",
  returned: "ลูกค้ารับของแล้ว",
  cancelled: "ยกเลิก",
};
export const RETURN_STATUS_COLOR: Record<ReturnStatus, string> = {
  issued: "bg-sky-50 text-sky-800 ring-sky-200",
  returned: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const DEFAULT_RETURN_NOTES = "ผู้รับได้ตรวจสอบสินค้าตามรายการข้างต้นแล้ว อยู่ในสภาพเรียบร้อย";

/** งานซ่อมที่เลือกใส่ในใบส่งคืนได้ */
export type ReturnableJob = {
  id: string;
  doc_no: string;
  status: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  description: string;
  serial_no: string;
  accessories: string[];
};

export function jobToItem(j: ReturnableJob): ReturnItem {
  return {
    job_id: j.id,
    doc_no: j.doc_no,
    description: j.description,
    serial_no: j.serial_no,
    qty: 1,
    unit: "เครื่อง",
    remark: j.accessories.length ? `อุปกรณ์: ${j.accessories.join(", ")}` : "",
  };
}

export function normalizeItems(raw: unknown): ReturnItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      job_id: typeof o.job_id === "string" && o.job_id ? o.job_id : null,
      doc_no: String(o.doc_no ?? ""),
      description: String(o.description ?? ""),
      serial_no: String(o.serial_no ?? ""),
      qty: Number(o.qty) || 0,
      unit: String(o.unit ?? ""),
      remark: String(o.remark ?? ""),
    };
  });
}
