import { createAdminClient } from "@/lib/supabase/admin";
import { setSetting } from "@/lib/settings";
import { backupFolder, uploadFile } from "@/lib/google-drive";
import { STATUS_LABEL, WARRANTY_LABEL, type RepairStatus } from "@/lib/constants";

const TABLES = [
  "branches",
  "customers",
  "tools",
  "repair_jobs",
  "repair_parts",
  "repair_images",
  "job_status_history",
  "job_notes",
  "line_messages",
  "line_contacts",
  "chat_messages",
  "tags",
  "contact_tags",
  "carriers",
  "shipments",
  "profiles",
] as const;

export type BackupInfo = {
  at: string;
  trigger: "manual" | "auto";
  files: { name: string; id: string; size: number }[];
  counts: Record<string, number>;
};

type Row = Record<string, unknown>;

async function fetchAll(table: string): Promise<Row[]> {
  const db = createAdminClient();
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`อ่านตาราง ${table} ไม่ได้: ${error.message}`);
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function bangkokStamp(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}_${g("hour")}${g("minute")}`;
}

/** สำรองข้อมูลทั้งหมดลง Google Drive: JSON (ครบทุกตาราง) + CSV สรุปงานซ่อม (เปิดใน Excel/Sheets ได้) */
export async function runBackup(trigger: BackupInfo["trigger"]): Promise<BackupInfo> {
  const data: Record<string, Row[]> = {};
  for (const t of TABLES) data[t] = await fetchAll(t).catch(() => []); // ตารางที่ยังไม่ได้สร้าง = ว่าง

  const stamp = bangkokStamp();
  const folderId = await backupFolder();
  const enc = new TextEncoder();

  // 1) JSON ครบทุกตาราง
  const json = enc.encode(
    JSON.stringify({ app: "CRM-SERVICE CENTER", version: 1, exported_at: new Date().toISOString(), tables: data }, null, 1),
  );
  const jsonFile = await uploadFile({ folderId, name: `backup_${stamp}.json`, mimeType: "application/json", data: json });

  // 2) CSV สรุปงานซ่อม + แชท/โน้ต
  const byId = <T extends Row>(rows: T[]) => new Map(rows.map((r) => [r.id as string, r]));
  const customers = byId(data.customers);
  const tools = byId(data.tools);
  const profiles = byId(data.profiles);

  const header = [
    "เลขที่เอกสาร", "วันที่รับ", "สถานะ", "ลูกค้า", "เบอร์โทร", "แบรนด์", "รุ่น", "S/N",
    "อาการเสีย", "ประกัน", "ช่าง", "ค่าอะไหล่", "ค่าแรง", "รวม", "ราคาประเมิน", "บันทึกการซ่อม/แชท",
  ];
  const lines = [header.join(",")];
  for (const j of data.repair_jobs) {
    const c = customers.get(j.customer_id as string);
    const t = tools.get(j.tool_id as string);
    const parts = data.repair_parts.filter((p) => p.repair_job_id === j.id);
    const partsTotal = parts.reduce((s, p) => s + Number(p.quantity) * Number(p.unit_price), 0);
    const labor = Number(j.labor_cost ?? 0);
    const notes = data.job_notes
      .filter((n) => n.repair_job_id === j.id)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((n) => {
        const who = (profiles.get(n.author_id as string)?.full_name as string) ?? "-";
        return `[${String(n.created_at).slice(0, 16).replace("T", " ")} ${who}] ${n.body}`;
      })
      .join(" | ");

    lines.push(
      [
        j.doc_no,
        j.received_at,
        STATUS_LABEL[j.status as RepairStatus] ?? j.status,
        c?.name,
        c?.phone,
        t?.brand,
        t?.model,
        t?.serial_number,
        j.issue_description,
        WARRANTY_LABEL[j.warranty as keyof typeof WARRANTY_LABEL] ?? j.warranty,
        j.technician_name,
        partsTotal.toFixed(2),
        labor.toFixed(2),
        (partsTotal + labor).toFixed(2),
        j.quotation_price,
        notes,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM ให้ Excel อ่านภาษาไทยถูก
  const csv = enc.encode("﻿" + lines.join("\r\n"));
  const csvFile = await uploadFile({ folderId, name: `งานซ่อม_${stamp}.csv`, mimeType: "text/csv", data: csv });

  const info: BackupInfo = {
    at: new Date().toISOString(),
    trigger,
    files: [
      { name: jsonFile.name, id: jsonFile.id, size: json.byteLength },
      { name: csvFile.name, id: csvFile.id, size: csv.byteLength },
    ],
    counts: Object.fromEntries(TABLES.map((t) => [t, data[t].length])),
  };
  await setSetting("last_backup", info);
  return info;
}
