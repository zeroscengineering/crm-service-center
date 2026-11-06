import { requireProfile } from "@/lib/auth";
import SidebarNav from "@/components/SidebarNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-zinc-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
            SC
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold">CRM-SERVICE CENTER</p>
            <p className="text-xs text-zinc-500">Milwaukee · Skil · Workpro</p>
          </div>
        </div>
        <div className="px-2 pb-2 md:flex-1">
          <SidebarNav isAdmin={isAdmin} />
        </div>
        <div className="hidden border-t border-zinc-200 p-4 md:block">
          <p className="truncate text-sm font-medium">{profile.full_name}</p>
          <p className="mb-3 text-xs text-zinc-500">
            {isAdmin ? "แอดมิน (แก้ไขได้)" : "ช่าง (ดูอย่างเดียว)"}
          </p>
          <form action="/auth/signout" method="post">
            <button className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
