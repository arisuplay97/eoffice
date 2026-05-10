import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Login rate limiting & lockout.
 *
 * Policy:
 * - Max 5 failed attempts per (IP + username) dalam 15 menit.
 * - Setelah 5 kali gagal: user di-lock 15 menit (lockedUntil di tabel User).
 * - Attempt record disimpan di LoginAttempt untuk audit forensic.
 *
 * Data storage pakai Prisma (Postgres) agar kompatibel dengan Vercel serverless
 * — tidak butuh Redis/in-memory shared state.
 */

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function makeKey(ip: string | null | undefined, username: string) {
  const raw = `${ip || "unknown"}|${username.toLowerCase()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export async function recordAttempt(args: {
  ip: string | null;
  username: string;
  success: boolean;
}) {
  const key = makeKey(args.ip, args.username);
  await prisma.loginAttempt.create({
    data: {
      key,
      ipAddress: args.ip || null,
      username: args.username.slice(0, 100),
      success: args.success,
    },
  });
  return key;
}

export async function countRecentFailures(key: string) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  return prisma.loginAttempt.count({
    where: { key, success: false, createdAt: { gte: since } },
  });
}

export async function isRateLimited(ip: string | null, username: string) {
  const key = makeKey(ip, username);
  const failures = await countRecentFailures(key);
  return { limited: failures >= MAX_ATTEMPTS, failures, key };
}

export async function lockUser(username: string) {
  const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
  await prisma.user
    .updateMany({
      where: { username },
      data: { lockedUntil: until, failedLoginCount: { increment: 1 } },
    })
    .catch(() => {});
  return until;
}

export async function incFailedLogin(username: string) {
  await prisma.user
    .updateMany({
      where: { username },
      data: { failedLoginCount: { increment: 1 } },
    })
    .catch(() => {});
}

export async function resetFailedLogin(userId: string, ip: string | null) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    },
  });
}

// Best-effort cleanup: jangan jalankan pada setiap request.
// Bisa dipanggil via cron / scheduled function.
export async function cleanupOldAttempts(keepDays = 30) {
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
  await prisma.loginAttempt
    .deleteMany({ where: { createdAt: { lt: cutoff } } })
    .catch(() => {});
}

export const RATE_LIMIT_CONFIG = {
  WINDOW_MINUTES,
  MAX_ATTEMPTS,
  LOCK_MINUTES,
};
