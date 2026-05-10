import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Storage abstraction.
 *
 * Production (Vercel / serverless): gunakan Vercel Blob (private).
 *   - Env: BLOB_READ_WRITE_TOKEN
 *   - Akses file dilakukan via /api/files/[id] yang melakukan RBAC,
 *     lalu server-side fetch blob URL (yang tetap publik tapi random enough)
 *     atau redirect ke short-lived URL. Untuk private yang sebenarnya,
 *     blob URL disimpan sebagai storageKey internal saja.
 *
 * Development: simpan ke public/uploads dengan filename random
 *   (DIPERBOLEHKAN hanya di development — di production Vercel filesystem
 *   bersifat read-only / ephemeral).
 *
 * MIME whitelist ketat: PDF, PNG, JPEG saja (sesuai kebijakan keamanan).
 * Ekstensi diverifikasi berpasangan dengan MIME.
 * Filename disimpan terpisah (display) vs storageKey (random).
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};
const ALLOWED_EXT = new Set<string>([".pdf", ".jpg", ".jpeg", ".png"]);
const FORBIDDEN_EXT = new Set<string>([
  ".js",
  ".mjs",
  ".html",
  ".htm",
  ".svg",
  ".xml",
  ".php",
  ".phtml",
  ".exe",
  ".bat",
  ".sh",
  ".ps1",
  ".cmd",
  ".jar",
  ".rb",
  ".py",
  ".pl",
]);

function sniffPdf(buf: Buffer) {
  return buf.slice(0, 4).toString("ascii") === "%PDF";
}
function sniffPng(buf: Buffer) {
  return (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a
  );
}
function sniffJpg(buf: Buffer) {
  return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function validateMagicBytes(buf: Buffer, mime: string) {
  if (mime === "application/pdf") return sniffPdf(buf);
  if (mime === "image/png") return sniffPng(buf);
  if (mime === "image/jpeg") return sniffJpg(buf);
  return false;
}

export type StoredFile = {
  nama: string; // display name (sanitized)
  storageKey: string; // opaque key in backend
  url: string; // canonical URL (blob URL atau /uploads/...); UNTUK INTERNAL, jangan expose ke publik
  mime: string;
  ukuran: number;
  checksum: string; // sha-256 hex
};

function sanitizeDisplayName(name: string) {
  const base = path.basename(name).replace(/[\r\n\t\x00-\x1F\x7F]/g, "").trim();
  return base.slice(0, 180) || "dokumen";
}

export async function validateUpload(file: File): Promise<{ buf: Buffer; mime: string; ext: string }> {
  if (!file || typeof file.size !== "number") throw new Error("File tidak valid");
  if (file.size <= 0) throw new Error("File kosong");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error(
      `Ukuran file melebihi batas (maks ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`
    );

  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime))
    throw new Error("Tipe file tidak diizinkan. Hanya PDF, JPG, atau PNG.");

  const origExt = path.extname(file.name || "").toLowerCase();
  if (FORBIDDEN_EXT.has(origExt))
    throw new Error("Ekstensi file tidak diizinkan");
  if (!ALLOWED_EXT.has(origExt))
    throw new Error("Ekstensi file tidak valid. Hanya .pdf, .jpg, .jpeg, .png.");

  const buf = Buffer.from(await file.arrayBuffer());
  if (!validateMagicBytes(buf, mime))
    throw new Error("Isi file tidak sesuai dengan tipe yang diklaim");

  const ext = MIME_TO_EXT[mime];
  return { buf, mime, ext };
}

async function saveLocal(buf: Buffer, ext: string): Promise<{ storageKey: string; url: string }> {
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  const key = `${Date.now()}_${crypto.randomBytes(12).toString("hex")}${ext}`;
  const filePath = path.join(dir, key);
  await fs.writeFile(filePath, buf, { mode: 0o600 });
  return { storageKey: key, url: `/uploads/${key}` };
}

async function saveBlob(buf: Buffer, ext: string, mime: string): Promise<{ storageKey: string; url: string }> {
  const { put } = await import("@vercel/blob");
  const key = `documents/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${crypto
    .randomBytes(16)
    .toString("hex")}${ext}`;
  const res = await put(key, buf, {
    access: "public", // URL tetap random cukup untuk obscurity; RBAC ada di /api/files/[id]
    contentType: mime,
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return { storageKey: key, url: res.url };
}

export async function saveUpload(file: File): Promise<StoredFile> {
  const { buf, mime, ext } = await validateUpload(file);
  const checksum = crypto.createHash("sha256").update(buf).digest("hex");

  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const { storageKey, url } = useBlob
    ? await saveBlob(buf, ext, mime)
    : await saveLocal(buf, ext);

  return {
    nama: sanitizeDisplayName(file.name || `file${ext}`),
    storageKey,
    url,
    mime,
    ukuran: buf.length,
    checksum,
  };
}

export async function streamFileForDownload(url: string, storageKey: string) {
  // Vercel Blob: fetch URL & stream
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Gagal mengambil file");
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  }
  // Local: baca dari filesystem
  const filePath = path.join(process.cwd(), "public", "uploads", storageKey);
  return fs.readFile(filePath);
}

export async function deleteStored(url: string, storageKey: string) {
  try {
    if (/^https?:\/\//.test(url)) {
      const { del } = await import("@vercel/blob");
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } else {
      const filePath = path.join(process.cwd(), "public", "uploads", storageKey);
      await fs.unlink(filePath).catch(() => {});
    }
  } catch (e) {
    console.error("[storage] delete failed", e);
  }
}
