"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; adminOnly?: boolean; soon?: boolean };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "แดชบอร์ด" },
  { href: "/jobs", label: "งานซ่อม (Pipeline)" },
  { href: "/jobs/new", label: "รับแจ้งซ่อมใหม่", adminOnly: true },
  { href: "/chat", label: "💬 แชทลูกค้า" },
  { href: "/customers", label: "ลูกค้า & เครื่องมือ" },
  { href: "/track", label: "หน้าเช็กสถานะ (ลูกค้า) ↗" },
  { href: "/settings", label: "⚙️ ตั้งค่า", adminOnly: true },
];

export default function SidebarNav({ isAdmin, badges = {} }: { isAdmin: boolean; badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.filter((i) => !i.adminOnly || isAdmin).map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/customers" && pathname.startsWith("/customers/")) ||
          (item.href === "/jobs" && pathname.startsWith("/jobs/") && pathname !== "/jobs/new");
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="flex cursor-not-allowed items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-zinc-400"
            >
              {item.label}
              <span className="rounded bg-zinc-100 px-1.5 text-[10px]">เร็วๆ นี้</span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            target={item.href === "/track" ? "_blank" : undefined}
            className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-brand/10 text-brand" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {item.label}
            {(badges[item.href] ?? 0) > 0 && (
              <span className="rounded-full bg-[#06C755] px-1.5 text-[11px] font-bold text-white">{badges[item.href]}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
