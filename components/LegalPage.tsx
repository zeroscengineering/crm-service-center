import Link from "next/link";
import { SHOP } from "@/lib/constants";

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-steel/50 px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-4 panel p-8 text-sm leading-relaxed text-zinc-700 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        <p className="text-xs text-muted">
          {SHOP.name} · ปรับปรุงล่าสุด 6 พฤศจิกายน 2569
        </p>
        {children}
        <p className="pt-6 text-xs text-muted">
          <Link href="/track" className="font-medium text-brand hover:underline">
            ติดตามสถานะการซ่อม
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="hover:underline">
            นโยบายความเป็นส่วนตัว
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="hover:underline">
            ข้อกำหนดการใช้งาน
          </Link>
        </p>
      </article>
    </main>
  );
}
