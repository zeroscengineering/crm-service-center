import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayBangkok } from "@/lib/format";
import NewJobForm from "./NewJobForm";
import type { CustomerWithTools } from "@/lib/types";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; line?: string; name?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/jobs");
  const sp = await searchParams;

  const supabase = await createClient();
  const [{ data: branches }, { data: staff }, { data: carrierRows }, custRes] = await Promise.all([
    supabase.from("branches").select("id, name").order("created_at"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("carriers").select("id, name, active").eq("active", true).order("sort"),
    sp.customer
      ? supabase.from("customers").select("*, tools(*)").eq("id", sp.customer).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">รับแจ้งซ่อมใหม่</h1>
        <p className="text-sm text-zinc-500">
          {sp.line ? "สร้างดีลจากแชท LINE — บันทึกแล้วแชทนี้จะผูกกับลูกค้าอัตโนมัติ · " : ""}
          บันทึกแล้วระบบจะเปิดใบรับเครื่องให้พิมพ์ทันที
        </p>
      </header>
      <NewJobForm
        branches={branches ?? []}
        technicians={(staff ?? []).map((s) => ({ id: s.id, name: s.full_name }))}
        today={todayBangkok()}
        carriers={(carrierRows ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
        initialCustomer={(custRes.data as CustomerWithTools | null) ?? null}
        lineUserId={sp.line ?? ""}
        defaultName={sp.name ?? ""}
      />
    </div>
  );
}
