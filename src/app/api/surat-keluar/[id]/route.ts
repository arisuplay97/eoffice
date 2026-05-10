import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canInputSuratKeluar } from "@/lib/auth";
import { ok, fail, unauthorized, forbidden, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertSameOrigin, canViewSuratKeluar, cleanText, isAdmin } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const item = await prisma.suratKeluar.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      unitPembuat: true,
      createdBy: { select: { id: true, nama: true, jabatan: true } },
      attachments: { where: { deletedAt: null } },
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: { petugas: { select: { id: true, nama: true, jabatan: true, unit: true } } },
      },
    },
  });
  if (!item) return notFound();

  if (!canViewSuratKeluar(session, item)) {
    await audit({
      userId: session.id,
      action: "ACCESS_DENIED",
      entityType: "SuratKeluar",
      entityId: item.id,
    });
    return forbidden("Anda tidak memiliki akses ke surat ini");
  }

  return ok({ item });
}

const updateSchema = z.object({
  tujuan: z.string().max(200).optional(),
  perihal: z.string().max(500).optional(),
  ringkasan: z.string().max(4000).optional().nullable(),
  tanggalSurat: z.string().optional(),
  penandatangan: z.string().max(200).optional(),
  status: z.enum(["DRAFT", "MENUNGGU_PARAF", "MENUNGGU_TTD", "TERKIRIM", "DIARSIPKAN"]).optional(),
  catatan: z.string().max(2000).optional().nullable(),
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
  if (!canInputSuratKeluar(session.role)) return forbidden();

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Input tidak valid");
    const d = parsed.data;

    const existing = await prisma.suratKeluar.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!existing) return notFound();
    if (!canViewSuratKeluar(session, existing))
      return forbidden("Anda tidak memiliki akses ke surat ini");

    const updated = await prisma.suratKeluar.update({
      where: { id: params.id },
      data: {
        ...(d.tujuan !== undefined && { tujuan: cleanText(d.tujuan, { max: 200 }) }),
        ...(d.perihal !== undefined && { perihal: cleanText(d.perihal, { max: 500 }) }),
        ...(d.ringkasan !== undefined && {
          ringkasan: cleanText(d.ringkasan, { max: 4000, allowNewline: true }) || null,
        }),
        ...(d.tanggalSurat && { tanggalSurat: new Date(d.tanggalSurat) }),
        ...(d.penandatangan !== undefined && { penandatangan: cleanText(d.penandatangan, { max: 200 }) }),
        ...(d.status && { status: d.status }),
        ...(d.catatan !== undefined && {
          catatan: cleanText(d.catatan, { max: 2000, allowNewline: true }) || null,
        }),
      },
    });

    if (d.status && d.status !== existing.status) {
      await prisma.trackingLog.create({
        data: {
          event:
            d.status === "TERKIRIM"
              ? "SURAT_DIKIRIM"
              : d.status === "DIARSIPKAN"
              ? "SURAT_DIARSIPKAN"
              : "STATUS_BERUBAH",
          judul:
            d.status === "TERKIRIM"
              ? "Surat dikirim"
              : d.status === "DIARSIPKAN"
              ? "Surat diarsipkan"
              : `Status berubah: ${d.status}`,
          petugasId: session.id,
          suratKeluarId: params.id,
        },
      });
    }

    await audit({
      userId: session.id,
      action: "SURAT_KELUAR_UPDATED",
      entityType: "SuratKeluar",
      entityId: params.id,
      metadata: { changedFields: Object.keys(d) },
    });

    return ok({ item: updated });
  } catch (e: any) {
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
    await prisma.suratKeluar.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });
    await audit({
      userId: session.id,
      action: "SURAT_KELUAR_DELETED",
      entityType: "SuratKeluar",
      entityId: params.id,
    });
    return ok({ deleted: true });
  } catch (e: any) {
    return fail(e?.message || "Gagal menghapus", 500);
  }
}
