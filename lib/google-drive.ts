/**
 * Google Drive client แบบเบา (REST API ตรง)
 * - เชื่อมต่อผ่านปุ่มในหน้า "ตั้งค่า" (OAuth) แล้วเก็บ refresh token ในตาราง app_settings
 * - scope drive.file = แอปเห็นเฉพาะไฟล์/โฟลเดอร์ที่แอปสร้างเอง
 * ใช้เฉพาะฝั่ง server เท่านั้น
 */
import { adminConfigured } from "@/lib/supabase/admin";
import { deleteSetting, getSetting, setSetting } from "@/lib/settings";

export const ROOT_FOLDER_NAME = "CRM-SERVICE CENTER";
export const BACKUP_FOLDER_NAME = "สำรองข้อมูล (Backups)";
export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file", "openid", "email"];

const SETTING_KEY = "google_drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export type DriveConnection = {
  refresh_token: string;
  email: string;
  name?: string;
  connected_at: string;
  connected_by?: string;
};

/** มี Client ID/Secret + service role key ใน Vercel แล้วหรือยัง */
export function driveClientConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && adminConfigured());
}

// ---------- connection (cache สั้น ๆ ต่อ instance) ----------
let connCache: { value: DriveConnection | null; at: number } | null = null;

export async function getConnection(): Promise<DriveConnection | null> {
  if (!driveClientConfigured()) return null;
  if (connCache && Date.now() - connCache.at < 60_000) return connCache.value;
  const value = await getSetting<DriveConnection>(SETTING_KEY);
  connCache = { value, at: Date.now() };
  return value;
}

export async function driveReady() {
  try {
    return Boolean(await getConnection());
  } catch {
    return false;
  }
}

export function resetDriveCache() {
  connCache = null;
  tokenCache = null;
  folderCache.clear();
}

export async function saveConnection(conn: DriveConnection) {
  await setSetting(SETTING_KEY, conn);
  resetDriveCache();
}

export async function removeConnection() {
  const conn = await getConnection();
  if (conn) {
    // ยกเลิกสิทธิ์ที่ฝั่ง Google ด้วย (ถ้าล้มเหลวก็ไม่เป็นไร)
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh_token)}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  await deleteSetting(SETTING_KEY);
  resetDriveCache();
}

// ---------- OAuth ----------
export function authUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) throw new Error(json.error_description ?? json.error ?? "แลก token ไม่สำเร็จ");
  return json;
}

// ---------- access token ----------
let tokenCache: { value: string; expiresAt: number } | null = null;

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const conn = await getConnection();
  if (!conn) throw new Error("ยังไม่ได้เชื่อมต่อ Google Drive (ไปที่เมนู ตั้งค่า)");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const reason =
      json.error === "invalid_grant"
        ? "สิทธิ์การเชื่อมต่อหมดอายุหรือถูกยกเลิก — กรุณากดเชื่อมต่อใหม่ในหน้าตั้งค่า"
        : json.error_description ?? json.error;
    throw new Error(`เชื่อม Google ไม่สำเร็จ: ${reason}`);
  }
  tokenCache = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return tokenCache.value;
}

export async function driveFetch(url: string, init: RequestInit = {}, token?: string) {
  const t = token ?? (await accessToken());
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Google Drive error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

// ---------- account info ----------
export type DriveAbout = {
  user?: { displayName?: string; emailAddress?: string };
  storageQuota?: { limit?: string; usage?: string; usageInDrive?: string; usageInDriveTrash?: string };
};

export async function getAbout(token?: string): Promise<DriveAbout> {
  const res = await driveFetch(`${API}/about?fields=user(displayName,emailAddress),storageQuota`, {}, token);
  return (await res.json()) as DriveAbout;
}

/** นับไฟล์ที่แอปสร้าง (ไม่นับโฟลเดอร์) และขนาดรวม */
export async function appFileStats() {
  let pageToken: string | undefined;
  let count = 0;
  let bytes = 0;
  for (let page = 0; page < 20; page++) {
    const q = encodeURIComponent(`trashed = false and mimeType != '${FOLDER_MIME}'`);
    const url = `${API}/files?q=${q}&pageSize=1000&fields=nextPageToken,files(size)${
      pageToken ? `&pageToken=${pageToken}` : ""
    }`;
    const json = (await (await driveFetch(url)).json()) as { nextPageToken?: string; files: { size?: string }[] };
    count += json.files.length;
    for (const f of json.files) bytes += Number(f.size ?? 0);
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return { count, bytes };
}

// ---------- folders ----------
function escapeQ(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(name: string, parentId?: string) {
  const q = [
    `name = '${escapeQ(name)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const res = await driveFetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  const json = (await res.json()) as { files: { id: string }[] };
  return json.files[0]?.id ?? null;
}

async function createFolder(name: string, parentId?: string) {
  const res = await driveFetch(`${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined }),
  });
  return ((await res.json()) as { id: string }).id;
}

const folderCache = new Map<string, string>();

async function ensureFolder(name: string, parentId?: string) {
  const key = `${parentId ?? "root"}/${name}`;
  const hit = folderCache.get(key);
  if (hit) return hit;
  const id = (await findFolder(name, parentId)) ?? (await createFolder(name, parentId));
  folderCache.set(key, id);
  return id;
}

export async function rootFolder() {
  return ensureFolder(ROOT_FOLDER_NAME);
}

/** CRM-SERVICE CENTER / <เลขที่เอกสาร> */
export async function jobFolder(docNo: string) {
  return ensureFolder(docNo, await rootFolder());
}

/** CRM-SERVICE CENTER / สำรองข้อมูล (Backups) */
export async function backupFolder() {
  return ensureFolder(BACKUP_FOLDER_NAME, await rootFolder());
}

export function folderUrl(id: string) {
  return `https://drive.google.com/drive/folders/${id}`;
}

// ---------- files ----------
export type DriveFile = { id: string; name: string; mimeType: string; webViewLink: string; size?: string };

export async function uploadFile(opts: {
  folderId: string;
  name: string;
  mimeType: string;
  data: ArrayBuffer | Uint8Array;
}) {
  const boundary = `crm-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: opts.name, parents: [opts.folderId] });
  const enc = new TextEncoder();
  const data = opts.data instanceof Uint8Array ? opts.data : new Uint8Array(opts.data);

  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.byteLength + data.byteLength + tail.byteLength);
  body.set(head, 0);
  body.set(data, head.byteLength);
  body.set(tail, head.byteLength + data.byteLength);

  const res = await driveFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()) as DriveFile;
}

export async function downloadFile(fileId: string) {
  return driveFetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
}

export async function deleteFile(fileId: string) {
  try {
    await driveFetch(`${API}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof Error && e.message.includes(" 404"))) throw e;
  }
}
