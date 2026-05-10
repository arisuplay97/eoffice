import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, canManageUsers } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertSameOrigin, cleanText } from "@/lib/security";

export const runtime = "nodejs";

const updateSchema = z.object({
  nama: z.string().max(200).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")).nullable(),
  jabatan: z.string().max(200).optional().nullable(),
  nip: z.string().max(50).optional().nullable(),
  role: z.enum(["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT", "KEPALA_BAGIAN", "STAF", "VIEWER"]).optional(),
  unitId: z.string().max(50).optional().nullable(),
  aktif: z.boolean().optional(),
  password: z
    .string()
    .min(8)
    .max(200)
    .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
      message: "Password harus mengandung huruf dan angka",
    })
    .optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return fail("Origin tidak valid", 403);
  }

  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageUsers(session.role)) return forbidden();

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");
    const d = parsed.data;

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) return notFound();

    // Safety rails
    if (existing.id === session.id && d.aktif === false) {
      return fail("Tidak dapat menonaktifkan diri sendiri");
    }
    if (existing.id === session.id && d.role && d.role !== existing.role) {
      return fail("Tidak dapat mengubah role sendiri");
    }

    const data: any = {
      ...(d.nama !== undefined && { nama: cleanText(d.nama, { max: 200 }) }),
      ...(d.email !== undefined && { email: d.email || null }),
      ...(d.jabatan !== undefined && { jabatan: cleanText(d.jabatan || "", { max: 200 }) || null }),
      ...(d.nip !== undefined && { nip: cleanText(d.nip || "", { max: 50 }) || null }),
      ...(d.role && { role: d.role }),
      ...(d.unitId !== undefined && { unitId: d.unitId }),
      ...(d.aktif !== undefined && { aktif: d.aktif }),
    };
    if (d.password) {
      data.password = await bcrypt.hash(d.password, 12);
      data.mustChangePassword = true;
      data.failedLoginCount = 0;
      data.lockedUntil = null;
    }

    const user = await prisma.user.update({ where: { id: params.id }, data });

    // Audit separate action types
    if (d.password) {
      await audit({
        userId: session.id,
        action: "PASSWORD_RESET",
        entityType: "User",
        entityId: user.id,
        description: `Reset password oleh admin`,
      });
    }
    if (d.role && d.role !== existing.role) {
      await audit({
        userId: session.id,
        action: "ROLE_CHANGED",
        entityType: "User",
        entityId: user.id,
        description: `${existing.role} → ${d.role}`,
      });
    }
    if (d.aktif === false && existing.aktif) {
      await audit({
        userId: session.id,
        action: "USER_DEACTIVATED",
        entityType: "User",
        entityId: user.id,
      });
    }
    await audit({
      userId: session.id,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: user.id,
      metadata: { changedFields: Object.keys(d) },
    });

    return ok({ id: user.id });
  } catch (e: any) {
    if (e?.code === "P2025") return notFound();
    return fail(e?.message || "Gagal memperbarui", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return fail("Origin tidak valid", 403);
  }
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageUsers(session.role)) return forbidden();
  if (session.id === params.id) return fail("Tidak dapat menghapus diri sendiri");
  try {
    await prisma.user.update({ where: { id: params.id }, data: { aktif: false } });
    await audit({
      userId: session.id,
      action: "USER_DEACTIVATED",
      entityType: "User",
      entityId: params.id,
    });
    return ok({ deactivated: true });
  } catch (e: any) {
    return fail(e?.message || "Gagal menonaktifkan user", 500);
  }
}
