import Link from "next/link";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen md:grid-cols-[1fr_minmax(420px,40%)]">
      <section className="relative hidden flex-col justify-between bg-graphite p-12 text-white md:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand font-mono font-semibold">SC</div>
          <p className="text-lg font-semibold tracking-tight">Service Center</p>
        </div>
        <div className="max-w-md">
          <p className="text-[34px] font-semibold leading-tight tracking-tight">
            รับเครื่อง ติดตามงาน
            <br />
            ส่งคืนลูกค้า ในที่เดียว
          </p>
          <p className="mt-4 text-sm text-zinc-400">ศูนย์บริการซ่อมเครื่องมือช่าง Milwaukee, Skil และ Workpro</p>
        </div>
        <p className="text-xs text-zinc-500">สำหรับพนักงานศูนย์บริการ</p>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1.5 bg-brand" />
      </section>

      <section className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-[26px] font-semibold tracking-tight">เข้าสู่ระบบ</h1>
          <p className="mb-8 mt-1 text-sm text-muted">ใช้อีเมลและรหัสผ่านที่แอดมินสร้างให้</p>
          <LoginForm next={next ?? "/dashboard"} />
          <p className="mt-8 border-t border-line pt-6 text-sm text-muted">
            ลูกค้าต้องการเช็กสถานะงานซ่อม?{" "}
            <Link href="/track" className="font-medium text-brand hover:underline">
              ตรวจสอบด้วยเลขที่เอกสาร
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
