import { prisma } from "@/lib/prisma";
import { getSession, canInputSuratKeluar } from "@/lib/auth";
import SuratKeluarListClient from "./list-client";

export const dynamic = "force-dynamic";

export default async function SuratKeluarPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; unitId?: string; tahun?: string; bulan?: string };
}) {
  const session = (await getSession())!;
  const units = await prisma.unit.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, kode: true },
  });

  const where: any = { deletedAt: null };
  const q = searchParams?.q?.trim() || "";
  if (q) {
    where.OR = [
      { nomorSurat: { contains: q, mode: "insensitive" } },
      { tujuan: { contains: q, mode: "insensitive" } },
      { perihal: { contains: q, mode: "insensitive" } },
    ];
  }
  if (searchParams?.status) where.status = searchParams.status as any;
  if (searchParams?.unitId) where.unitPembuatId = searchParams.unitId;
  if (searchParams?.tahun || searchParams?.bulan) {
    const y = Number(searchParams?.tahun || new Date().getFullYear());
    const m = searchParams?.bulan ? Number(searchParams.bulan) - 1 : 0;
    const start = searchParams?.bulan ? new Date(y, m, 1) : new Date(y, 0, 1);
    const end = searchParams?.bulan ? new Date(y, m + 1, 1) : new Date(y + 1, 0, 1);
    where.tanggalSurat = { gte: start, lt: end };
  }

  const items = await prisma.suratKeluar.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      unitPembuat: { select: { nama: true } },
      _count: { select: { attachments: true } },
    },
  });

  return (
    <SuratKeluarListClient
      canInput={canInputSuratKeluar(session.role)}
      items={JSON.parse(JSON.stringify(items))}
      units={units}
      initialFilters={searchParams || {}}
      defaultUnitId={session.unitId || ""}
    />
  );
}
