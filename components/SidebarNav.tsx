"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Plus,
  Settings,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean; external?: boolean; match?: string };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/jobs", label: "งานซ่อม", icon: Wrench, match: "/jobs" },
  { href: "/quotes", label: "ใบเสนอราคา", icon: FileText, match: "/quotes" },
  { href: "/chat", label: "แชทลูกค้า", icon: MessageCircle, match: "/chat" },
  { href: "/customers", label: "ลูกค้า", icon: Users, match: "/customers" },
  { href: "/shipping", label: "ขนส่ง", icon: Truck, match: "/shipping" },
  { href: "/settings", label: "ตั้งค่า", icon: Settings, adminOnly: true, match: "/settings" },
  { href: "/track", label: "หน้าเช็กสถานะลูกค้า", icon: ExternalLink, external: true },
];

export default function SidebarNav({ isAdmin, badges = {} }: { isAdmin: boolean; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const isActive = (i: Item) =>
    pathname === i.href || (i.match ? pathname.startsWith(i.match) && !(i.href === "/jobs" && pathname === "/jobs/new") : false);

  return (
    <nav className="flex gap-1 md:flex-col md:gap-0.5">
      {isAdmin && (
        <Link
          href="/jobs/new"
          className={`flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md md:mb-3 px-3 py-2 text-sm font-semibold transition-colors ${
            pathname === "/jobs/new" ? "bg-white text-graphite" : "bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          <Plus size={16} strokeWidth={2.5} />
          รับแจ้งซ่อมใหม่
        </Link>
      )}
      {ITEMS.filter((i) => !i.adminOnly || isAdmin).map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        const badge = badges[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            className={`group relative flex shrink-0 items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
              active ? "bg-white/10 font-medium text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            } ${item.external ? "text-xs md:mt-3" : ""}`}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand" />}
            <Icon size={item.external ? 14 : 18} strokeWidth={1.75} className="shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {badge > 0 && (
              <span className="rounded-full bg-[#06C755] px-1.5 text-[11px] font-semibold leading-5 text-white">{badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
