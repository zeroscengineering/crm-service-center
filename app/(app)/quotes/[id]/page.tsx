import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mergeFooter, type QuoteFooter, type QuoteStatus, type VatMode } from "@/lib/quote";
import { getQuoteDefaults } from "@/lib/company";
import { PageHeader } from "@/components/ui";
import QuoteEditor from "../QuoteEditor";
import type { QuoteInput } from "../actions";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: q }, { data: items }, defaults] = await Promise.all([
    supabase.from("quotations").select("*, repair_jobs(doc_no)").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("description, qty, unit, unit_price").eq("quotation_id", id).order("sort"),
    getQuoteDefaults(),
  ]);
  if (!q) notFound();

  const initial: QuoteInput = {
    id: q.id as string,
    quote_no: q.quote_no as string,
    repair_job_id: (q.repair_job_id as string | null) ?? null,
    customer_id: (q.customer_id as string | null) ?? null,
    customer_name: (q.customer_name as string) ?? "",
    customer_address: (q.customer_address as string | null) ?? "",
    customer_phone: (q.customer_phone as string | null) ?? "",
    customer_tax_id: (q.customer_tax_id as string | null) ?? "",
    customer_branch: (q.customer_branch as string | null) ?? "",
    subject: (q.subject as string | null) ?? "",
    issue_date: q.issue_date as string,
    valid_days: Number(q.valid_days),
    status: q.status as QuoteStatus,
    discount: Number(q.discount),
    vat_mode: q.vat_mode as VatMode,
    notes: (q.notes as string | null) ?? "",
    terms: (q.terms as string | null) ?? "",
    footer: mergeFooter(defaults.footer, q.footer as Partial<QuoteFooter> | null),
    items: (items ?? []).map((i) => ({
      description: i.description as string,
      qty: Number(i.qty),
      unit: (i.unit as string | null) ?? "",
      unit_price: Number(i.unit_price),
    })),
  };
  const jobDocNo = (q.repair_jobs as { doc_no: string } | null)?.doc_no ?? null;

  return (
    <div>
      <Link href="/quotes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> ใบเสนอราคาทั้งหมด
      </Link>
      <PageHeader title={<span className="font-mono">{initial.quote_no}</span>} description={initial.customer_name} />
      <QuoteEditor initial={initial} canEdit={Boolean(profile)} jobDocNo={jobDocNo} />
    </div>
  );
}
