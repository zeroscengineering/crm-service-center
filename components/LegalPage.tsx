import Link from "next/link";
import { SHOP } from "@/lib/constants";

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 text-sm leading-relaxed text-zinc-700 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        <p className="text-xs text-zinc-500">
          {SHOP.name} · ปรับปรุงล่าสุด 6 พฤศจิกายน 2569
        </p>
        {children}
        <p className="pt-6 text-xs text-zinc-500">
          <Link href="/track" className="text-brand hover:underline">
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
