import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, canManageUsers } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertSameOrigin, cleanText } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const q = cleanText(searchParams.get("q"), { max: 100 });
  const unitId = searchParams.get("unitId");
  const role = searchParams.get("role");
  const scope = searchParams.get("scope");

  // Non-admin hanya boleh list user (untuk dropdown disposisi), bukan detail sensitif.
  const isAdmin = canManageUsers(session.role);

  const where: any = {};
  if (q) {
    where.OR = [
      { nama: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { jabatan: { contains: q, mode: "insensitive" } },
    ];
  }
  if (unitId) where.unitId = unitId;
  if (role) where.role = role as any;
  if (scope === "active" || !isAdmin) where.aktif = true;

  const items = await prisma.user.findMany({
    where,
    orderBy: [{ aktif: "desc" }, { nama: "asc" }],
    include: { unit: { select: { id: true, nama: true, kode: true } } },
  });

  const mapped = items.map((u) =>
    isAdmin
      ? {
          id: u.id,
          username: u.username,
          nama: u.nama,
          email: u.email,
          jabatan: u.jabatan,
          nip: u.nip,
          role: u.role,
          aktif: u.aktif,
          unit: u.unit,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
        }
      : {
          id: u.id,
          nama: u.nama,
          jabatan: u.jabatan,
          role: u.role,
          unit: u.unit,
        }
  );

  return ok({ items: mapped });
}

const createSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username hanya boleh huruf/angka/._-"),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(200)
    .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
      message: "Password harus mengandung huruf dan angka",
    }),
  nama: z.string().min(1).max(200),
  email: z.string().email().max(200).optional().or(z.literal("")).nullable(),
  jabatan: z.string().max(200).optional().nullable(),
  nip: z.string().max(50).optional().nullable(),
  role: z.enum(["SUPER_ADMIN", "DIREKSI", "SEKRETARIAT", "KEPALA_BAGIAN", "STAF", "VIEWER"]),
  unitId: z.string().max(50).optional().nullable(),
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
  if (!canManageUsers(session.role)) return forbidden();

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");
    const d = parsed.data;

    const dup = await prisma.user.findUnique({ where: { username: d.username } });
    if (dup) return fail("Username sudah digunakan");

    const created = await prisma.user.create({
      data: {
        username: d.username,
        password: await bcrypt.hash(d.password, 12),
        nama: cleanText(d.nama, { max: 200 }),
        email: d.email || null,
        jabatan: cleanText(d.jabatan || "", { max: 200 }) || null,
        nip: cleanText(d.nip || "", { max: 50 }) || null,
        role: d.role,
        unitId: d.unitId || null,
        mustChangePassword: true,
      },
    });

    await audit({
      userId: session.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: created.id,
      description: `User baru: ${created.username} (${created.role})`,
    });

    return ok({ id: created.id });
  } catch (e: any) {
    return fail(e?.message || "Gagal membuat user", 500);
  }
}
