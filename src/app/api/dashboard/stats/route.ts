import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const now = new Date();
  const y = now.getFullYear();
  const startOfMonth = new Date(y, now.getMonth(), 1);
  const startOfYear = new Date(y, 0, 1);
  const endOfYear = new Date(y + 1, 0, 1);

  // Base filter: soft-delete
  const smWhere: any = { deletedAt: null };
  const skWhere: any = { deletedAt: null };

  const [
    totalSuratMasuk,
    totalSuratKeluar,
    disposisiAktif,
    disposisiSelesai,
    disposisiTerlambat,
    suratBulanIni,
    menungguTindakLanjut,
    suratMasukYear,
    suratKeluarYear,
    disposisiByStatus,
    suratByUnit,
  ] = await Promise.all([
    prisma.suratMasuk.count({ where: smWhere }),
    prisma.suratKeluar.count({ where: skWhere }),
    prisma.disposisi.count({
      where: { status: { in: ["BARU", "DIBACA", "DIPROSES", "DITINDAKLANJUTI"] } },
    }),
    prisma.disposisi.count({ where: { status: "SELESAI" } }),
    prisma.disposisi.count({
      where: {
        deadline: { lt: now },
        status: { notIn: ["SELESAI", "DITOLAK"] },
      },
    }),
    prisma.suratMasuk.count({ where: { ...smWhere, tanggalDiterima: { gte: startOfMonth } } }),
    prisma.disposisi.count({
      where: { status: { in: ["BARU", "DIBACA", "DIPROSES"] } },
    }),
    prisma.suratMasuk.findMany({
      where: { ...smWhere, tanggalDiterima: { gte: startOfYear, lt: endOfYear } },
      select: { tanggalDiterima: true },
    }),
    prisma.suratKeluar.findMany({
      where: { ...skWhere, tanggalSurat: { gte: startOfYear, lt: endOfYear } },
      select: { tanggalSurat: true },
    }),
    prisma.disposisi.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.suratMasuk.groupBy({
      by: ["unitTujuanId"],
      _count: { _all: true },
      where: { ...smWhere, unitTujuanId: { not: null } },
    }),
  ]);

  const monthsSM = Array(12).fill(0);
  const monthsSK = Array(12).fill(0);
  suratMasukYear.forEach((s) => monthsSM[s.tanggalDiterima.getMonth()]++);
  suratKeluarYear.forEach((s) => monthsSK[s.tanggalSurat.getMonth()]++);

  // resolve unit names
  const unitIds = suratByUnit.map((s) => s.unitTujuanId!).filter(Boolean);
  const units = unitIds.length
    ? await prisma.unit.findMany({ where: { id: { in: unitIds } }, select: { id: true, nama: true } })
    : [];
  const unitMap = new Map(units.map((u) => [u.id, u.nama]));

  return ok({
    stat: {
      totalSuratMasuk,
      totalSuratKeluar,
      disposisiAktif,
      disposisiSelesai,
      disposisiTerlambat,
      suratBulanIni,
      menungguTindakLanjut,
    },
    chart: {
      trenBulanan: monthsSM.map((_, i) => ({
        bulan: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][i],
        masuk: monthsSM[i],
        keluar: monthsSK[i],
      })),
      disposisiByStatus: disposisiByStatus.map((d) => ({
        status: d.status,
        total: d._count._all,
      })),
      suratByUnit: suratByUnit.map((s) => ({
        unit: unitMap.get(s.unitTujuanId!) || "-",
        total: s._count._all,
      })),
    },
  });
}
