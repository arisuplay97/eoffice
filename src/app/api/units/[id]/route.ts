import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertSameOrigin, cleanText, isAdmin } from "@/lib/security";

export const runtime = "nodejs";

const updateSchema = z.object({
  nama: z.string().max(200).optional(),
  kode: z.string().max(30).optional(),
  tipe: z.string().max(50).optional().nullable(),
  deskripsi: z.string().max(2000).optional().nullable(),
  aktif: z.boolean().optional(),
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
  if (!isAdmin(session)) return forbidden();
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");
    const d = parsed.data;
    const u = await prisma.unit.update({
      where: { id: params.id },
      data: {
        ...(d.nama !== undefined && { nama: cleanText(d.nama, { max: 200 }) }),
        ...(d.kode !== undefined && { kode: cleanText(d.kode, { max: 30 }).toUpperCase() }),
        ...(d.tipe !== undefined && { tipe: cleanText(d.tipe || "", { max: 50 }) || null }),
        ...(d.deskripsi !== undefined && {
          deskripsi: cleanText(d.deskripsi || "", { max: 2000, allowNewline: true }) || null,
        }),
        ...(d.aktif !== undefined && { aktif: d.aktif }),
      },
    });
    await audit({
      userId: session.id,
      action: d.aktif === false ? "UNIT_DEACTIVATED" : "UNIT_UPDATED",
      entityType: "Unit",
      entityId: u.id,
      metadata: { changedFields: Object.keys(d) },
    });
    return ok({ id: u.id });
  } catch (e: any) {
    if (e?.code === "P2025") return notFound();
    if (e?.code === "P2002") return fail("Kode unit sudah digunakan");
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
  if (!isAdmin(session)) return forbidden();
  try {
    const u = await prisma.unit.update({
      where: { id: params.id },
      data: { aktif: false },
    });
    await audit({
      userId: session.id,
      action: "UNIT_DEACTIVATED",
      entityType: "Unit",
      entityId: u.id,
    });
    return ok({ id: u.id });
  } catch (e: any) {
    return fail(e?.message || "Gagal menonaktifkan unit", 500);
  }
}
