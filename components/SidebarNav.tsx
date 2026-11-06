"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; adminOnly?: boolean; soon?: boolean };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "แดชบอร์ด" },
  { href: "/jobs", label: "งานซ่อม (Pipeline)" },
  { href: "/jobs/new", label: "รับแจ้งซ่อมใหม่", adminOnly: true },
  { href: "/customers", label: "ลูกค้า & เครื่องมือ" },
  { href: "/track", label: "หน้าเช็กสถานะ (ลูกค้า) ↗" },
];

export default function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
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
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-brand/10 text-brand" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
