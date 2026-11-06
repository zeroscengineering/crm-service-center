import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { STATUS_LABEL, WARRANTY_LABEL, type RepairStatus } from "@/lib/constants";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import FileGallery, { type JobFile } from "@/components/FileGallery";
import { driveReady } from "@/lib/google-drive";
import { CostPanel, JobInfoForm, NoteForm, StatusControl, type Part } from "./JobPanels";

type Job = {
  id: string;
  doc_no: string;
  status: RepairStatus;
  issue_description: string;
  warranty: keyof typeof WARRANTY_LABEL;
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
  customers: { id: string; name: string; phone: string; line_id: string | null; line_user_id: string | null; address: string | null } | null;
  tools: { brand: string; model: string; serial_number: string | null } | null;
  branches: { name: string } | null;
};

type History = { id: string; from_status: RepairStatus | null; to_status: RepairStatus; created_at: string; profiles: { full_name: string } | null };
type Note = { id: string; body: string; created_at: string; profiles: { full_name: string } | null };

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd>{children || "-"}</dd>
    </div>
  );
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const canEdit = profile.role === "admin";
  const supabase = await createClient();

  const [jobRes, partsRes, historyRes, notesRes, staffRes, filesRes] = await Promise.all([
    supabase
      .from("repair_jobs")
      .select(
        "*, customers(id, name, phone, line_id, line_user_id, address), tools(brand, model, serial_number), branches(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("repair_parts").select("id, part_name, part_code, quantity, unit_price").eq("repair_job_id", id).order("created_at"),
    supabase
      .from("job_status_history")
      .select("id, from_status, to_status, created_at, profiles(full_name)")
      .eq("repair_job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("job_notes")
      .select("id, body, created_at, profiles(full_name)")
      .eq("repair_job_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("repair_images")
      .select("id, category, file_name, mime_type, image_url, created_at")
      .eq("repair_job_id", id)
      .order("created_at"),
  ]);

  if (!jobRes.data) notFound();
  const job = jobRes.data as unknown as Job;
  const parts = (partsRes.data ?? []) as Part[];
  const history = (historyRes.data ?? []) as unknown as History[];
  const notes = (notesRes.data ?? []) as unknown as Note[];
  const files = (filesRes.data ?? []) as JobFile[];
  const technicians = (staffRes.data ?? []).map((s) => ({ id: s.id as string, name: s.full_name as string }));

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-zinc-500 hover:underline">
        ← กลับไป Pipeline
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold">{job.doc_no}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-zinc-600">
            {job.tools?.brand} {job.tools?.model} · {job.customers?.name}
          </p>
          <p className="text-xs text-zinc-400">
            รับเครื่อง {formatDate(job.received_at)} · อัปเดตล่าสุด {formatDateTime(job.updated_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canEdit && <StatusControl jobId={job.id} status={job.status} />}
          <Link
            href={`/print/job/${job.id}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
          >
            🖨️ พิมพ์ใบรับเครื่อง
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="ข้อมูลงานซ่อม">
            <dl>
              <Info label="อาการเสีย">{job.issue_description}</Info>
              <Info label="สถานะประกัน">{WARRANTY_LABEL[job.warranty]}</Info>
              <Info label="ช่างผู้รับผิดชอบ">{job.technician_name}</Info>
              <Info label="อุปกรณ์ที่ฝาก">{job.accessories.join(", ")}</Info>
              <Info label="เอกสารที่แนบ">{job.received_documents.join(", ")}</Info>
              <Info label="หมายเหตุ/สภาพ">{job.repair_notes}</Info>
              <Info label="สาขา">{job.branches?.name}</Info>
              {job.completed_at && <Info label="ซ่อมเสร็จ">{formatDateTime(job.completed_at)}</Info>}
              {job.delivered_at && <Info label="ส่งมอบ">{formatDateTime(job.delivered_at)}</Info>}
            </dl>
            {canEdit && <JobInfoForm job={job} technicians={technicians} />}
          </Card>

          <Card title="อะไหล่และค่าใช้จ่าย">
            <CostPanel
              jobId={job.id}
              parts={parts}
              laborCost={Number(job.labor_cost)}
              quotationPrice={job.quotation_price === null ? null : Number(job.quotation_price)}
              canEdit={canEdit}
            />
          </Card>

          <Card title={`บันทึกการซ่อม / แชท (${notes.length})`}>
            {canEdit && (
              <div className="mb-4">
                <NoteForm jobId={job.id} />
              </div>
            )}
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-zinc-50 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {n.profiles?.full_name ?? "-"} · {formatDateTime(n.created_at)}
                  </p>
                </li>
              ))}
              {notes.length === 0 && <li className="text-sm text-zinc-400">ยังไม่มีบันทึก</li>}
            </ul>
          </Card>

          <Card title={`รูปภาพ & เอกสาร (${files.length})`}>
            <FileGallery jobId={job.id} files={files} canEdit={canEdit} configured={await driveReady()} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="ลูกค้า"
            action={
              job.customers && (
                <Link href={`/customers/${job.customers.id}`} className="text-sm text-brand hover:underline">
                  ประวัติทั้งหมด
                </Link>
              )
            }
          >
            <dl>
              <Info label="ชื่อ">{job.customers?.name}</Info>
              <Info label="โทร">
                {job.customers?.phone && (
                  <a href={`tel:${job.customers.phone}`} className="text-brand hover:underline">
                    {formatPhone(job.customers.phone)}
                  </a>
                )}
              </Info>
              <Info label="LINE ID">{job.customers?.line_id}</Info>
              <Info label="แจ้งเตือน LINE">{job.customers?.line_user_id ? "เชื่อมแล้ว ✅" : "ยังไม่เชื่อม"}</Info>
              <Info label="ที่อยู่">{job.customers?.address}</Info>
            </dl>
          </Card>

          <Card title="เครื่องมือ">
            <dl>
              <Info label="แบรนด์">{job.tools?.brand}</Info>
              <Info label="รุ่น">{job.tools?.model}</Info>
              <Info label="S/N">
                <span className="font-mono">{job.tools?.serial_number}</span>
              </Info>
            </dl>
          </Card>

          <Card title="ไทม์ไลน์สถานะ">
            <ol className="relative space-y-4 border-l-2 border-zinc-200 pl-4">
              {history.map((h, i) => (
                <li key={h.id} className="relative">
                  <span
                    className={`absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                      i === 0 ? "bg-brand" : "bg-zinc-300"
                    }`}
                  />
                  <p className={`text-sm ${i === 0 ? "font-semibold" : ""}`}>{STATUS_LABEL[h.to_status]}</p>
                  <p className="text-xs text-zinc-400">
                    {formatDateTime(h.created_at)}
                    {h.profiles?.full_name && ` · ${h.profiles.full_name}`}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
