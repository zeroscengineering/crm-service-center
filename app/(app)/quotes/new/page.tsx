import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayBangkok } from "@/lib/format";
import { DEFAULT_TERMS, type QuoteItem } from "@/lib/quote";
import { PageHeader } from "@/components/ui";
import QuoteEditor from "../QuoteEditor";
import { nextQuoteNo, type QuoteInput } from "../actions";

export const dynamic = "force-dynamic";

type JobRow = {
  id: string;
  doc_no: string;
  issue_description: string;
  labor_cost: number | null;
  customer_id: string;
  customers: { name: string; phone: string; address: string | null } | null;
  tools: { brand: string; model: string; serial_number: string | null } | null;
};

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/quotes");
  const { job: jobId } = await searchParams;
  const supabase = await createClient();

  let job: JobRow | null = null;
  let items: QuoteItem[] = [];
  if (jobId) {
    const [{ data: j }, { data: parts }] = await Promise.all([
      supabase
        .from("repair_jobs")
        .select("id, doc_no, issue_description, labor_cost, customer_id, customers(name, phone, address), tools(brand, model, serial_number)")
        .eq("id", jobId)
        .maybeSingle(),
      supabase.from("repair_parts").select("part_name, part_code, quantity, unit_price").eq("repair_job_id", jobId).order("created_at"),
    ]);
    job = (j as unknown as JobRow) ?? null;
    // ยกอะไหล่ที่เคยบันทึกไว้ในงานซ่อมมาเป็นรายการ
    items = (parts ?? []).map((p) => ({
      description: [p.part_name, p.part_code ? `(${p.part_code})` : ""].filter(Boolean).join(" "),
      qty: Number(p.quantity),
      unit: "ชิ้น",
      unit_price: Number(p.unit_price),
    }));
    if (job && Number(job.labor_cost) > 0) {
      items.push({ description: "ค่าแรง / ค่าบริการซ่อม", qty: 1, unit: "งาน", unit_price: Number(job.labor_cost) });
    }
  }

  const tool = job?.tools ? `${job.tools.brand} ${job.tools.model}${job.tools.serial_number ? ` S/N ${job.tools.serial_number}` : ""}` : "";
  const initial: QuoteInput = {
    quote_no: await nextQuoteNo(),
    repair_job_id: job?.id ?? null,
    customer_id: job?.customer_id ?? null,
    customer_name: job?.customers?.name ?? "",
    customer_address: job?.customers?.address ?? "",
    customer_phone: job?.customers?.phone ?? "",
    customer_tax_id: "",
    customer_branch: "",
    subject: job ? `ค่าซ่อม ${tool} (งานซ่อมเลขที่ ${job.doc_no})` : "",
    issue_date: todayBangkok(),
    valid_days: 30,
    status: "draft",
    discount: 0,
    vat_mode: "exclude",
    notes: job ? `อาการเสีย: ${job.issue_description}` : "",
    terms: DEFAULT_TERMS,
    items,
  };

  return (
    <div>
      <Link
        href={job ? `/jobs/${job.id}` : "/quotes"}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> {job ? "กลับไปงานซ่อม" : "ใบเสนอราคาทั้งหมด"}
      </Link>
      <PageHeader title="สร้างใบเสนอราคา" />
      <QuoteEditor initial={initial} canEdit jobDocNo={job?.doc_no ?? null} />
    </div>
  );
}
