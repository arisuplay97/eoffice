import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Nomor agenda surat masuk: AGD/YYYY/MM/0001
 * Counter disimpan di tabel Counter dengan key "agenda" (reset per tahun+bulan tidak dilakukan;
 * penomoran tetap berurutan per tahun agar mudah audit. Jika ingin reset per bulan, gunakan
 * key "agenda-YYYY-MM").
 */
export async function generateNomorAgenda(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const key = `agenda-${y}-${m}`;
  const counter = await prisma.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  const n = String(counter.value).padStart(4, "0");
  return `AGD/${y}/${m}/${n}`;
}

/**
 * Nomor surat keluar: TAR/UNIT/YYYY/MM/0001
 */
export async function generateNomorSuratKeluar(unitKode: string, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const key = `sk-${unitKode}-${y}-${m}`;
  const counter = await prisma.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  const n = String(counter.value).padStart(4, "0");
  return `TAR/${unitKode}/${y}/${m}/${n}`;
}

/**
 * Kode verifikasi: TIARA-YYYYMMDD-RANDOM6
 */
export function generateVerifikasiKode(prefix = "TIARA", date = new Date()) {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

/**
 * Signature hash - HMAC SHA-256 dari payload penting + JWT_SECRET, dipotong 32 char.
 * Digunakan untuk validasi keaslian saat verifikasi publik.
 */
export function generateSignatureHash(payload: string) {
  const secret = process.env.JWT_SECRET || "tiara-secret";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

export function verifySignatureHash(payload: string, sig: string) {
  const expected = generateSignatureHash(payload);
  // timingSafeEqual requires same length
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
