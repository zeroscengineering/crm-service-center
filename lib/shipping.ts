export type Carrier = {
  id: string;
  name: string;
  tracking_url: string | null;
  phone: string | null;
  active: boolean;
  sort: number;
};

export type ShipmentStatus = "pending" | "shipped" | "delivered";
export type ShipmentDirection = "inbound" | "outbound";

export type Shipment = {
  id: string;
  repair_job_id: string | null;
  customer_id: string | null;
  direction: ShipmentDirection;
  carrier_id: string | null;
  tracking_no: string | null;
  sender_name: string | null;
  status: ShipmentStatus;
  shipped_at: string | null;
  cost: number | null;
  note: string | null;
  created_at: string;
};

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: "รอส่ง",
  shipped: "ส่งแล้ว / ระหว่างทาง",
  delivered: "ถึงปลายทางแล้ว",
};

export const SHIPMENT_STATUS_COLOR: Record<ShipmentStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  shipped: "bg-sky-50 text-sky-800 ring-sky-200",
  delivered: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export const DIRECTION_LABEL: Record<ShipmentDirection, string> = {
  inbound: "ลูกค้าส่งเข้า",
  outbound: "ร้านส่งคืน",
};

export function trackingLink(carrier: Pick<Carrier, "tracking_url"> | null | undefined, trackingNo: string | null) {
  if (!carrier?.tracking_url || !trackingNo) return null;
  return carrier.tracking_url.replace("{tracking}", encodeURIComponent(trackingNo.trim()));
}
