import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden } from "@/lib/api";
import { canViewSuratKeluar, canViewSuratMasuk } from "@/lib/security";

export const runtime = "nodejs";

// Akses tracking detail membutuhkan login (berbeda dengan verify publik).
export async function GET(_req: NextRequest, { params }: { params: { kode: string } }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const kode = decodeURIComponent(params.kode);
  if (kode.length > 100) return notFound("Tracking tidak ditemukan");

  const sm = await prisma.suratMasuk.findFirst({
    where: {
      deletedAt: null,
      OR: [{ kodeVerifikasi: kode }, { nomorAgenda: kode }, { nomorSurat: kode }],
    },
    include: {
      unitTujuan: true,
      createdBy: { select: { nama: true, jabatan: true } },
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: { petugas: { select: { nama: true, jabatan: true, unit: true } } },
      },
    },
  });

  if (sm) {
    const allowed = await canViewSuratMasuk(session, sm.id);
    if (!allowed) return forbidden("Anda tidak memiliki akses");
    return ok({
      jenis: "surat_masuk",
      nomor: sm.nomorAgenda,
      nomorSurat: sm.nomorSurat,
      perihal: sm.perihal,
      status: sm.status,
      prioritas: sm.prioritas,
      unit: sm.unitTujuan?.nama || null,
      kodeVerifikasi: sm.kodeVerifikasi,
      logs: sm.trackingLogs,
    });
  }

  const sk = await prisma.suratKeluar.findFirst({
    where: {
      deletedAt: null,
      OR: [{ kodeVerifikasi: kode }, { nomorSurat: kode }],
    },
    include: {
      unitPembuat: true,
      createdBy: { select: { nama: true, jabatan: true } },
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: { petugas: { select: { nama: true, jabatan: true, unit: true } } },
      },
    },
  });

  if (sk) {
    if (!canViewSuratKeluar(session, sk)) return forbidden("Anda tidak memiliki akses");
    return ok({
      jenis: "surat_keluar",
      nomor: sk.nomorSurat,
      perihal: sk.perihal,
      status: sk.status,
      unit: sk.unitPembuat?.nama || null,
      kodeVerifikasi: sk.kodeVerifikasi,
      logs: sk.trackingLogs,
    });
  }

  return notFound("Tracking tidak ditemukan");
}
