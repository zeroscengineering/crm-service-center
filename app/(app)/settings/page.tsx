import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminConfigured } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import {
  appFileStats,
  driveClientConfigured,
  folderUrl,
  getAbout,
  getConnection,
  rootFolder,
  type DriveAbout,
  type DriveConnection,
} from "@/lib/google-drive";
import type { BackupInfo } from "@/lib/backup";
import { formatDateTime } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import { BackupButton, CopyText, DisconnectButton } from "./SettingsClient";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_configured: "ยังไม่ได้ใส่ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY ใน Vercel",
  access_denied: "คุณกดปฏิเสธสิทธิ์ในหน้า Google",
  state_mismatch: "การเชื่อมต่อหมดเวลา กรุณากดเชื่อมต่อใหม่",
  scope_denied: "ไม่ได้ติ๊กอนุญาตสิทธิ์ Google Drive ในหน้า Google — กดเชื่อมต่อใหม่แล้วติ๊กช่อง Drive",
  no_refresh_token:
    "Google ไม่ส่งสิทธิ์ระยะยาวกลับมา — ไปที่ myaccount.google.com/permissions ลบแอป CRM Service Center แล้วกดเชื่อมต่อใหม่",
};

function gb(bytes: number) {
  return (bytes / 1024 ** 3).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}
function mb(bytes: number) {
  return (bytes / 1024 ** 2).toLocaleString("th-TH", { maximumFractionDigits: 1 });
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex gap-2 text-sm">
      <span>{ok ? "✅" : "⬜"}</span>
      <span>
        <span className={ok ? "text-zinc-500 line-through" : "font-medium"}>{label}</span>
        {!ok && hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </li>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string; drive_error?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;

  const redirectUri = `${await siteUrl()}/api/google/callback`;
  const hasClient = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasServiceKey = adminConfigured();

  // ตรวจว่ารัน SQL 0002 แล้วหรือยัง
  let tableReady = false;
  let conn: DriveConnection | null = null;
  let lastBackup: BackupInfo | null = null;
  if (hasServiceKey) {
    try {
      lastBackup = await getSetting<BackupInfo>("last_backup");
      tableReady = true;
      conn = driveClientConfigured() ? await getConnection() : null;
    } catch {
      tableReady = false;
    }
  }

  // ข้อมูลจาก Drive
  let about: DriveAbout | null = null;
  let stats: { count: number; bytes: number } | null = null;
  let rootUrl: string | null = null;
  let driveError: string | null = null;
  if (conn) {
    try {
      [about, stats, rootUrl] = await Promise.all([getAbout(), appFileStats(), rootFolder().then(folderUrl)]);
    } catch (e) {
      driveError = e instanceof Error ? e.message : "ติดต่อ Google Drive ไม่ได้";
    }
  }

  // จำนวนไฟล์ที่ผูกกับงานซ่อม (จากฐานข้อมูล)
  const supabase = await createClient();
  const { data: imgRows } = await supabase.from("repair_images").select("category");
  const byCat = { before: 0, after: 0, document: 0 } as Record<string, number>;
  for (const r of imgRows ?? []) byCat[r.category as string] = (byCat[r.category as string] ?? 0) + 1;

  const limit = Number(about?.storageQuota?.limit ?? 0);
  const usage = Number(about?.storageQuota?.usage ?? 0);
  const free = limit ? Math.max(limit - usage, 0) : 0;
  const pct = limit ? Math.min(100, (usage / limit) * 100) : 0;

  const errorText = sp.drive_error ? ERRORS[sp.drive_error] ?? decodeURIComponent(sp.drive_error) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ตั้งค่า</h1>
        <p className="text-sm text-zinc-500">การเชื่อมต่อบริการภายนอก (เฉพาะแอดมิน)</p>
      </header>

      {sp.drive === "connected" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          ✅ เชื่อมต่อ Google Drive สำเร็จ
        </p>
      )}
      {sp.drive === "disconnected" && (
        <p className="rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">ยกเลิกการเชื่อมต่อ Google Drive แล้ว</p>
      )}
      {errorText && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">⚠️ {errorText}</p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-xl">📁</span>
            <div>
              <h2 className="font-semibold">Google Drive</h2>
              <p className="text-xs text-zinc-500">เก็บรูปก่อน/หลังซ่อม เอกสาร และสำรองข้อมูล (แชท ลูกค้า งานซ่อม)</p>
            </div>
          </div>
          {conn ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              ● เชื่อมต่อแล้ว
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">○ ยังไม่เชื่อมต่อ</span>
          )}
        </div>

        <div className="space-y-5 p-5">
          {/* ---------- ยังตั้งค่าไม่ครบ ---------- */}
          {!(hasClient && hasServiceKey && tableReady) && (
            <div className="space-y-4">
              <p className="text-sm">ตั้งค่าครั้งแรก (ทำครั้งเดียว) — ดูขั้นตอนละเอียดใน <code>docs/google-drive-setup.md</code></p>
              <ul className="space-y-2">
                <Check
                  ok={hasServiceKey}
                  label="ใส่ SUPABASE_SERVICE_ROLE_KEY ใน Vercel"
                  hint="Supabase → Project Settings → API Keys → service_role (secret) — ใช้เก็บสิทธิ์ Google อย่างปลอดภัย"
                />
                <Check
                  ok={tableReady}
                  label="รัน SQL supabase/migrations/0002_app_settings.sql"
                  hint="Supabase → SQL Editor → วางไฟล์ → Run"
                />
                <Check
                  ok={hasClient}
                  label="ใส่ GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ใน Vercel"
                  hint="ได้จาก Google Cloud Console → OAuth Client (ใส่ Redirect URI ด้านล่าง)"
                />
              </ul>
              <div>
                <p className="mb-1 text-sm font-medium">Authorized redirect URI (คัดลอกไปใส่ใน Google Cloud)</p>
                <CopyText text={redirectUri} />
              </div>
              <p className="text-xs text-zinc-500">ใส่ค่าใน Vercel แล้วต้องกด Redeploy จึงจะมีผล</p>
            </div>
          )}

          {/* ---------- พร้อมเชื่อมต่อ ---------- */}
          {hasClient && hasServiceKey && tableReady && !conn && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-zinc-600">
                กดปุ่มด้านล่าง แล้วเลือกบัญชี Google ที่ต้องการใช้เก็บไฟล์ ระบบจะสร้างโฟลเดอร์ “CRM-SERVICE CENTER” ให้อัตโนมัติ
                และมองเห็นเฉพาะไฟล์ที่ระบบสร้างเท่านั้น
              </p>
              <a
                href="/api/google/connect"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark"
              >
                เชื่อมต่อ Google Drive
              </a>
              <p className="text-xs text-zinc-500">
                ถ้าเจอหน้า “Google hasn’t verified this app” ให้กด Advanced → Go to CRM Service Center → ติ๊กอนุญาต Drive → Continue
              </p>
            </div>
          )}

          {/* ---------- เชื่อมต่อแล้ว ---------- */}
          {conn && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p>
                    บัญชี: <span className="font-semibold">{about?.user?.emailAddress ?? conn.email}</span>
                  </p>
                  <p className="text-xs text-zinc-500">เชื่อมต่อเมื่อ {formatDateTime(conn.connected_at)}</p>
                </div>
                {rootUrl && (
                  <a href={rootUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    เปิดโฟลเดอร์ใน Google Drive ↗
                  </a>
                )}
              </div>

              {driveError ? (
                <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">⚠️ {driveError}</p>
              ) : (
                <>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>พื้นที่ Google Drive</span>
                      <span className="text-zinc-500">
                        {limit ? `ใช้ไป ${gb(usage)} / ${gb(limit)} GB` : `ใช้ไป ${gb(usage)} GB (ไม่จำกัด)`}
                      </span>
                    </div>
                    {limit > 0 && (
                      <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full ${pct > 90 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Stat label="พื้นที่เหลือ" value={limit ? `${gb(free)} GB` : "ไม่จำกัด"} sub={limit ? `${(100 - pct).toFixed(0)}% ของทั้งหมด` : undefined} />
                    <Stat
                      label="ไฟล์ที่ระบบบันทึกใน Drive"
                      value={`${(stats?.count ?? 0).toLocaleString("th-TH")} ไฟล์`}
                      sub={`ขนาดรวม ${mb(stats?.bytes ?? 0)} MB`}
                    />
                    <Stat
                      label="ไฟล์แนบงานซ่อม"
                      value={`${(byCat.before + byCat.after + byCat.document).toLocaleString("th-TH")} ไฟล์`}
                      sub={`ก่อนซ่อม ${byCat.before} · หลังซ่อม ${byCat.after} · เอกสาร ${byCat.document}`}
                    />
                  </div>
                </>
              )}

              <div className="rounded-lg border border-zinc-200 p-4">
                <h3 className="font-medium">สำรองข้อมูล (แชท/โน้ต · ลูกค้า · งานซ่อม · อะไหล่)</h3>
                <p className="mb-3 text-xs text-zinc-500">
                  บันทึกเป็นไฟล์ JSON (ครบทุกตาราง) + CSV สรุปงานซ่อมพร้อมบันทึกแชท (เปิดใน Excel/Google Sheets ได้)
                  ลงโฟลเดอร์ “สำรองข้อมูล (Backups)” · ระบบสำรองอัตโนมัติทุกคืนเวลา 02:00 น.
                  {!process.env.CRON_SECRET && " (ต้องตั้ง CRON_SECRET ใน Vercel ก่อน)"}
                </p>
                <p className="mb-3 text-sm">
                  ล่าสุด:{" "}
                  {lastBackup ? (
                    <>
                      <span className="font-medium">{formatDateTime(lastBackup.at)}</span>{" "}
                      <span className="text-zinc-500">
                        ({lastBackup.trigger === "auto" ? "อัตโนมัติ" : "กดเอง"} · งานซ่อม {lastBackup.counts.repair_jobs ?? 0} · ลูกค้า{" "}
                        {lastBackup.counts.customers ?? 0} · บันทึก {lastBackup.counts.job_notes ?? 0})
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-500">ยังไม่เคยสำรอง</span>
                  )}
                </p>
                <BackupButton />
              </div>

              <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-4">
                <a href="/api/google/connect" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100">
                  เปลี่ยนบัญชี / เชื่อมต่อใหม่
                </a>
                <DisconnectButton />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-500">
        💬 LINE OA (แจ้งเตือนลูกค้า) — จะเพิ่มในหน้านี้ในเฟส 5
      </section>
    </div>
  );
}
