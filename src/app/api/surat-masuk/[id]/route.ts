import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canInputSuratMasuk } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertSameOrigin, canViewSuratMasuk, cleanText, isAdmin } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const allowed = await canViewSuratMasuk(session, params.id);
  if (!allowed) {
    await audit({
      userId: session.id,
      action: "ACCESS_DENIED",
      entityType: "SuratMasuk",
      entityId: params.id,
    });
    return forbidden("Anda tidak memiliki akses ke surat ini");
  }

  const item = await prisma.suratMasuk.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      unitTujuan: true,
      createdBy: { select: { id: true, nama: true, jabatan: true } },
      attachments: { where: { deletedAt: null } },
      disposisi: {
        orderBy: { createdAt: "asc" },
        include: {
          fromUser: { select: { id: true, nama: true, jabatan: true } },
          toUser: { select: { id: true, nama: true, jabatan: true } },
          toUnit: true,
          attachments: { where: { deletedAt: null } },
        },
      },
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: { petugas: { select: { id: true, nama: true, jabatan: true, unit: true } } },
      },
    },
  });
  if (!item) return notFound("Surat masuk tidak ditemukan");
  return ok({ item });
}

const updateSchema = z.object({
  nomorSurat: z.string().max(100).optional(),
  tanggalSurat: z.string().optional(),
  tanggalDiterima: z.string().optional(),
  asalSurat: z.string().max(200).optional(),
  perihal: z.string().max(500).optional(),
  ringkasan: z.string().max(4000).optional().nullable(),
  prioritas: z.enum(["BIASA", "PENTING", "SEGERA", "RAHASIA"]).optional(),
  unitTujuanId: z.string().max(50).optional().nullable(),
  catatan: z.string().max(2000).optional().nullable(),
  status: z.enum(["DITERIMA", "DIDISPOSISIKAN", "DIPROSES", "SELESAI", "DIARSIPKAN"]).optional(),
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
  if (!canInputSuratMasuk(session.role)) return forbidden();

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");

    const existing = await prisma.suratMasuk.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!existing) return notFound("Surat masuk tidak ditemukan");

    const d = parsed.data;
    const updated = await prisma.suratMasuk.update({
      where: { id: params.id },
      data: {
        ...(d.nomorSurat !== undefined && { nomorSurat: cleanText(d.nomorSurat, { max: 100 }) }),
        ...(d.tanggalSurat && { tanggalSurat: new Date(d.tanggalSurat) }),
        ...(d.tanggalDiterima && { tanggalDiterima: new Date(d.tanggalDiterima) }),
        ...(d.asalSurat !== undefined && { asalSurat: cleanText(d.asalSurat, { max: 200 }) }),
        ...(d.perihal !== undefined && { perihal: cleanText(d.perihal, { max: 500 }) }),
        ...(d.ringkasan !== undefined && {
          ringkasan: cleanText(d.ringkasan, { max: 4000, allowNewline: true }) || null,
        }),
        ...(d.prioritas && { prioritas: d.prioritas }),
        ...(d.unitTujuanId !== undefined && { unitTujuanId: d.unitTujuanId }),
        ...(d.catatan !== undefined && {
          catatan: cleanText(d.catatan, { max: 2000, allowNewline: true }) || null,
        }),
        ...(d.status && { status: d.status }),
      },
    });

    if (d.status && d.status !== existing.status) {
      await prisma.trackingLog.create({
        data: {
          event: d.status === "DIARSIPKAN" ? "SURAT_DIARSIPKAN" : "STATUS_BERUBAH",
          judul:
            d.status === "DIARSIPKAN"
              ? "Surat diarsipkan"
              : `Status surat berubah: ${d.status}`,
          petugasId: session.id,
          suratMasukId: params.id,
        },
      });
    }

    await audit({
      userId: session.id,
      action: d.status === "DIARSIPKAN" ? "SURAT_MASUK_ARCHIVED" : "SURAT_MASUK_UPDATED",
      entityType: "SuratMasuk",
      entityId: params.id,
      metadata: { changedFields: Object.keys(d) },
    });

    return ok({ item: updated });
  } catch (e: any) {
    console.error(e);
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
    await prisma.suratMasuk.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });
    await audit({
      userId: session.id,
      action: "SURAT_MASUK_DELETED",
      entityType: "SuratMasuk",
      entityId: params.id,
    });
    return ok({ deleted: true });
  } catch (e: any) {
    return fail(e?.message || "Gagal menghapus", 500);
  }
}
