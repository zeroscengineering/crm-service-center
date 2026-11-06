import Link from "next/link";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white">
            SC
          </div>
          <h1 className="text-xl font-bold">CRM-SERVICE CENTER</h1>
          <p className="text-sm text-zinc-500">สำหรับพนักงานศูนย์บริการ</p>
        </div>
        <LoginForm next={next ?? "/dashboard"} />
        <p className="mt-6 text-center text-sm text-zinc-500">
          ลูกค้าต้องการเช็กสถานะ?{" "}
          <Link href="/track" className="font-medium text-brand hover:underline">
            ตรวจสอบด้วยเลขที่เอกสาร
          </Link>
        </p>
      </div>
    </main>
  );
}
