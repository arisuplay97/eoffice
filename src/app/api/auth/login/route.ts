import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import {
  isRateLimited,
  recordAttempt,
  lockUser,
  incFailedLogin,
  resetFailedLogin,
  RATE_LIMIT_CONFIG,
} from "@/lib/rate-limit";
import { audit, getClientInfo } from "@/lib/audit";
import { assertSameOrigin, cleanText } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  username: z.string().min(1, "Username wajib diisi").max(100),
  password: z.string().min(1, "Password wajib diisi").max(200),
});

// Generic message untuk semua jenis kegagalan (tidak boleh membocorkan info)
const GENERIC_FAIL = "Username atau password salah";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return fail("Origin tidak valid", 403);
  }

  const { ip, ua } = getClientInfo();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request tidak valid", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(GENERIC_FAIL, 401);

  const username = cleanText(parsed.data.username, { max: 100 }).trim();
  const password = parsed.data.password;
  if (!username || !password) return fail(GENERIC_FAIL, 401);

  // Rate limit per (IP + username)
  const rl = await isRateLimited(ip, username);
  if (rl.limited) {
    await audit({
      action: "RATE_LIMITED",
      description: `Login throttled for ${username}`,
      ip,
      ua,
    });
    return fail(
      `Terlalu banyak percobaan. Coba lagi dalam ${RATE_LIMIT_CONFIG.WINDOW_MINUTES} menit.`,
      429
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });

  // Konstanta waktu compare — selalu jalankan bcrypt meski user tidak ada,
  // untuk mencegah timing attack enumerasi username.
  const dummyHash = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8VHoQh8a/eq2BGr.0sXXYYYYYYYYY.";
  const hashToCompare = user?.password || dummyHash;
  const passwordMatches = await bcrypt.compare(password, hashToCompare);

  const now = new Date();
  const isLocked = !!user?.lockedUntil && user.lockedUntil > now;

  if (!user || !user.aktif || isLocked || !passwordMatches) {
    await recordAttempt({ ip, username, success: false });
    if (user) await incFailedLogin(username);

    // Setelah threshold: lock akun
    if (user && !isLocked) {
      const currentFailures = (user.failedLoginCount || 0) + 1;
      if (currentFailures >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS) {
        const until = await lockUser(username);
        await audit({
          userId: user.id,
          action: "LOGIN_LOCKED",
          entityType: "User",
          entityId: user.id,
          description: `Akun dikunci sampai ${until.toISOString()}`,
          ip,
          ua,
        });
      }
    }

    await audit({
      userId: user?.id ?? null,
      action: "LOGIN_FAIL",
      description: `Gagal login: ${username}${isLocked ? " (locked)" : ""}`,
      ip,
      ua,
    });
    return fail(GENERIC_FAIL, 401);
  }

  // Success
  await recordAttempt({ ip, username, success: true });
  await resetFailedLogin(user.id, ip);

  const token = await signSession({
    id: user.id,
    username: user.username,
    nama: user.nama,
    role: user.role,
    unitId: user.unitId,
    jabatan: user.jabatan,
  });
  await setSessionCookie(token);

  await audit({
    userId: user.id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user.id,
    description: `Login berhasil`,
    ip,
    ua,
  });

  return ok({
    user: {
      id: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role,
      jabatan: user.jabatan,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
