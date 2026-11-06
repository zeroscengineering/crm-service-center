import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayBangkok } from "@/lib/format";
import NewJobForm from "./NewJobForm";

export default async function NewJobPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/jobs");

  const supabase = await createClient();
  const [{ data: branches }, { data: staff }] = await Promise.all([
    supabase.from("branches").select("id, name").order("created_at"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">รับแจ้งซ่อมใหม่</h1>
        <p className="text-sm text-zinc-500">บันทึกแล้วระบบจะเปิดใบรับเครื่องให้พิมพ์ทันที</p>
      </header>
      <NewJobForm
        branches={branches ?? []}
        technicians={(staff ?? []).map((s) => ({ id: s.id, name: s.full_name }))}
        today={todayBangkok()}
      />
    </div>
  );
}
