import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import DashboardCharts from "./charts-client";
import {
  IconInbox,
  IconOutbox,
  IconDisposisi,
  IconCheck,
  IconWarning,
  IconClock,
  IconFile,
} from "@/components/ui/Icons";
import { formatDate } from "@/lib/utils";
import { PRIORITAS_COLOR, SURAT_MASUK_STATUS_COLOR, SURAT_MASUK_STATUS_LABEL } from "@/lib/constants";

async function loadStats() {
  const now = new Date();
  const y = now.getFullYear();
  const startOfMonth = new Date(y, now.getMonth(), 1);
  const startOfYear = new Date(y, 0, 1);
  const endOfYear = new Date(y + 1, 0, 1);

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
    recentSuratMasuk,
  ] = await Promise.all([
    prisma.suratMasuk.count({ where: { deletedAt: null } }),
    prisma.suratKeluar.count({ where: { deletedAt: null } }),
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
    prisma.suratMasuk.count({ where: { deletedAt: null, tanggalDiterima: { gte: startOfMonth } } }),
    prisma.disposisi.count({
      where: { status: { in: ["BARU", "DIBACA", "DIPROSES"] } },
    }),
    prisma.suratMasuk.findMany({
      where: { deletedAt: null, tanggalDiterima: { gte: startOfYear, lt: endOfYear } },
      select: { tanggalDiterima: true },
    }),
    prisma.suratKeluar.findMany({
      where: { deletedAt: null, tanggalSurat: { gte: startOfYear, lt: endOfYear } },
      select: { tanggalSurat: true },
    }),
    prisma.disposisi.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.suratMasuk.groupBy({
      by: ["unitTujuanId"],
      _count: { _all: true },
      where: { deletedAt: null, unitTujuanId: { not: null } },
    }),
    prisma.suratMasuk.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 7,
      include: {
        unitTujuan: { select: { nama: true } },
      },
    }),
  ]);

  const monthsSM = Array(12).fill(0);
  const monthsSK = Array(12).fill(0);
  suratMasukYear.forEach((s) => monthsSM[s.tanggalDiterima.getMonth()]++);
  suratKeluarYear.forEach((s) => monthsSK[s.tanggalSurat.getMonth()]++);

  const unitIds = suratByUnit.map((s) => s.unitTujuanId!).filter(Boolean);
  const units = unitIds.length
    ? await prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, nama: true },
      })
    : [];
  const unitMap = new Map(units.map((u) => [u.id, u.nama]));

  return {
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
      suratByUnit: suratByUnit
        .map((s) => ({
          unit: unitMap.get(s.unitTujuanId!) || "-",
          total: s._count._all,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    },
    recentSuratMasuk,
  };
}

export default async function DashboardPage() {
  const session = (await getSession())!;
  const data = await loadStats();
  const s = data.stat;

  return (
    <>
      <PageHeader
        title={`Selamat datang, ${session.nama.split(" ")[0]}.`}
        subtitle="Ringkasan persuratan, disposisi, dan tindak lanjut hari ini."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Surat Masuk"
          value={s.totalSuratMasuk}
          hint="Kumulatif seluruh periode"
          tone="blue"
          icon={<IconInbox className="h-5 w-5" />}
        />
        <StatCard
          label="Total Surat Keluar"
          value={s.totalSuratKeluar}
          hint="Kumulatif seluruh periode"
          tone="indigo"
          icon={<IconOutbox className="h-5 w-5" />}
        />
        <StatCard
          label="Disposisi Aktif"
          value={s.disposisiAktif}
          hint="Sedang berjalan"
          tone="amber"
          icon={<IconDisposisi className="h-5 w-5" />}
        />
        <StatCard
          label="Disposisi Selesai"
          value={s.disposisiSelesai}
          hint="Sudah ditindaklanjuti"
          tone="emerald"
          icon={<IconCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Disposisi Terlambat"
          value={s.disposisiTerlambat}
          hint="Melewati deadline"
          tone="red"
          icon={<IconWarning className="h-5 w-5" />}
        />
        <StatCard
          label="Surat Bulan Ini"
          value={s.suratBulanIni}
          hint="Diterima pada bulan berjalan"
          tone="blue"
          icon={<IconFile className="h-5 w-5" />}
        />
        <StatCard
          label="Menunggu Tindak Lanjut"
          value={s.menungguTindakLanjut}
          hint="Perlu perhatian"
          tone="amber"
          icon={<IconClock className="h-5 w-5" />}
        />
        <StatCard
          label="Produktivitas"
          value={
            s.disposisiSelesai + s.disposisiAktif > 0
              ? `${Math.round(
                  (s.disposisiSelesai / (s.disposisiSelesai + s.disposisiAktif)) * 100
                )}%`
              : "-"
          }
          hint="Rasio selesai / aktif"
          tone="emerald"
          icon={<IconCheck className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-800">
              Tren Surat Masuk & Keluar {new Date().getFullYear()}
            </h3>
            <p className="text-xs text-ink-500">per bulan</p>
          </div>
          <DashboardCharts.Tren data={data.chart.trenBulanan} />
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-800 mb-4">
            Status Disposisi
          </h3>
          <DashboardCharts.DisposisiStatus data={data.chart.disposisiByStatus} />
        </div>

        <div className="lg:col-span-3 card p-5">
          <h3 className="text-sm font-semibold text-ink-800 mb-4">
            Distribusi Surat Masuk per Unit / Bidang (Top 8)
          </h3>
          <DashboardCharts.ByUnit data={data.chart.suratByUnit} />
        </div>
      </div>

      <div className="mt-6 card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-800">Surat Masuk Terbaru</h3>
          <Link href="/surat-masuk" className="text-xs text-brand-700 hover:underline font-medium">
            Lihat semua
          </Link>
        </div>
        {data.recentSuratMasuk.length === 0 ? (
          <div className="py-8 text-sm text-ink-500 text-center">Belum ada data surat masuk.</div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>No. Agenda</TH>
                <TH>Asal / Perihal</TH>
                <TH>Prioritas</TH>
                <TH>Unit Tujuan</TH>
                <TH>Status</TH>
                <TH>Tanggal</TH>
              </tr>
            </THead>
            <tbody>
              {data.recentSuratMasuk.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs text-ink-900">
                    <Link href={`/surat-masuk/${r.id}`} className="hover:underline">
                      {r.nomorAgenda}
                    </Link>
                  </TD>
                  <TD>
                    <div className="max-w-md">
                      <p className="text-ink-900 font-medium line-clamp-1">{r.perihal}</p>
                      <p className="text-xs text-ink-500 line-clamp-1">{r.asalSurat}</p>
                    </div>
                  </TD>
                  <TD>
                    <span className={`chip ${PRIORITAS_COLOR[r.prioritas]}`}>
                      {r.prioritas}
                    </span>
                  </TD>
                  <TD className="text-xs">{r.unitTujuan?.nama || "-"}</TD>
                  <TD>
                    <span className={`chip ${SURAT_MASUK_STATUS_COLOR[r.status]}`}>
                      {SURAT_MASUK_STATUS_LABEL[r.status]}
                    </span>
                  </TD>
                  <TD className="text-xs text-ink-500">{formatDate(r.tanggalDiterima)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
