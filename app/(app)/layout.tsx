import { LogOut } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SidebarNav from "@/components/SidebarNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  // จำนวนแชทที่ยังไม่อ่าน (ถ้ายังไม่สร้างตาราง = 0)
  const supabase = await createClient();
  const { data: unreadRows } = await supabase.from("line_contacts").select("unread_count").gt("unread_count", 0);
  const unread = (unreadRows ?? []).reduce((s, r) => s + Number(r.unread_count ?? 0), 0);

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-graphite text-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col">
        <div className="flex items-center gap-3 px-5 pb-5 pt-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand font-mono text-sm font-semibold">
            SC
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">Service Center</p>
            <p className="text-xs text-zinc-400">Milwaukee, Skil, Workpro</p>
          </div>
        </div>
        <div className="overflow-x-auto px-3 pb-3 md:flex-1">
          <SidebarNav isAdmin={isAdmin} badges={{ "/chat": unread }} />
        </div>
        <div className="hidden items-center gap-3 border-t border-white/10 px-5 py-4 md:flex">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium">
            {profile.full_name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{profile.full_name}</p>
            <p className="text-xs text-zinc-400">{isAdmin ? "แอดมิน" : "ช่าง (ดูอย่างเดียว)"}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button title="ออกจากระบบ" className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
