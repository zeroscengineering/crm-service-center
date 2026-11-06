import type { Brand, RepairStatus } from "./constants";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  line_id: string | null;
  line_user_id: string | null;
  address: string | null;
  created_at: string;
};

export type Tool = {
  id: string;
  customer_id: string;
  brand: Brand;
  model: string;
  serial_number: string | null;
  created_at: string;
};

export type CustomerWithTools = Customer & { tools: Tool[] };

export type RepairJob = {
  id: string;
  doc_no: string;
  tool_id: string;
  customer_id: string;
  branch_id: string | null;
  issue_description: string;
  status: RepairStatus;
  warranty: "in_warranty" | "out_of_warranty" | "unknown";
  accessories: string[];
  received_documents: string[];
  quotation_price: number | null;
  labor_cost: number;
  repair_notes: string | null;
  technician_id: string | null;
  technician_name: string | null;
  received_at: string;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};
