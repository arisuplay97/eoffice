import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, unauthorized } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  oldPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(8, "Password baru minimal 8 karakter")
    .max(200)
    .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
      message: "Password harus mengandung huruf dan angka",
    }),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return fail("Origin tidak valid", 403);
  }

  const session = await getSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request tidak valid");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");

  const { oldPassword, newPassword } = parsed.data;
  if (oldPassword === newPassword) {
    return fail("Password baru tidak boleh sama dengan password lama");
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || !user.aktif) return unauthorized();

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) {
    await audit({
      userId: user.id,
      action: "LOGIN_FAIL",
      entityType: "User",
      entityId: user.id,
      description: "Gagal ganti password: password lama salah",
    });
    return fail("Password lama salah");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false,
    },
  });

  await audit({
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
  });

  return ok({ updated: true });
}
