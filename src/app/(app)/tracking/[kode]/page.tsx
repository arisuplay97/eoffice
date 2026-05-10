import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader } from "@/components/shell/PageHeader";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { Empty } from "@/components/ui/Empty";
import {
  PRIORITAS_COLOR,
  SURAT_MASUK_STATUS_COLOR,
  SURAT_MASUK_STATUS_LABEL,
  SURAT_KELUAR_STATUS_COLOR,
  SURAT_KELUAR_STATUS_LABEL,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { IconTracking, IconSearch } from "@/components/ui/Icons";
import { canViewSuratKeluar, canViewSuratMasuk } from "@/lib/security";

export const dynamic = "force-dynamic";

async function findByKode(kode: string) {
  if (kode.length > 100) return null;

  const sm = await prisma.suratMasuk.findFirst({
    where: {
      deletedAt: null,
      OR: [{ kodeVerifikasi: kode }, { nomorAgenda: kode }, { nomorSurat: kode }],
    },
    include: {
      unitTujuan: true,
      createdBy: { select: { nama: true, jabatan: true } },
      disposisi: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, deadline: true },
      },
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: {
          petugas: {
            select: { nama: true, jabatan: true, unit: { select: { nama: true } } },
          },
        },
      },
    },
  });
  if (sm) return { jenis: "masuk" as const, data: sm };

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
        include: {
          petugas: {
            select: { nama: true, jabatan: true, unit: { select: { nama: true } } },
          },
        },
      },
    },
  });
  if (sk) return { jenis: "keluar" as const, data: sk };

  return null;
}

export default async function TrackingDetailPage({
  params,
}: {
  params: { kode: string };
}) {
  const session = (await getSession())!;
  const kode = decodeURIComponent(params.kode);
  const result = await findByKode(kode);

  // RBAC: tidak tampilkan detail jika user tidak berhak (hindari IDOR/enumerasi).
  let accessDenied = false;
  if (result) {
    if (result.jenis === "masuk") {
      const allowed = await canViewSuratMasuk(session, result.data.id);
      if (!allowed) accessDenied = true;
    } else {
      if (!canViewSuratKeluar(session, result.data)) accessDenied = true;
    }
  }

  if (!result || accessDenied) {
    return (
      <>
        <PageHeader
          title="Tracking Dokumen"
          subtitle={`Menelusuri: ${kode.slice(0, 80)}`}
          action={
            <Link href="/tracking" className="btn-secondary">
              <IconSearch className="h-4 w-4" /> Pencarian Baru
            </Link>
          }
        />
        <Empty
          title={accessDenied ? "Akses ditolak" : "Dokumen tidak ditemukan"}
          description={
            accessDenied
              ? "Anda tidak memiliki izin untuk melihat tracking dokumen ini. Hubungi administrator bila Anda merasa ini keliru."
              : `Tidak ada dokumen di sistem dengan kode yang Anda cari. Pastikan kode, nomor agenda, atau nomor surat yang dimasukkan benar.`
          }
          action={
            <Link href="/tracking" className="btn-primary">
              Telusuri Ulang
            </Link>
          }
        />
      </>
    );
  }

  const isMasuk = result.jenis === "masuk";
  const d: any = result.data;

  let isLate = false;
  if (isMasuk && d.disposisi?.[0]?.deadline) {
    const deadlinePast = new Date(d.disposisi[0].deadline) < new Date();
    const stillOpen = !["SELESAI", "DITOLAK"].includes(d.disposisi[0].status);
    if (deadlinePast && stillOpen && d.status !== "DIARSIPKAN") {
      isLate = true;
    }
  }

  const tlItems: TimelineItem[] = d.trackingLogs.map((t: any, idx: number) => ({
    id: t.id,
    judul: t.judul,
    keterangan: t.keterangan,
    waktu: t.createdAt,
    oleh: t.petugas?.nama || "Sistem",
    unit: t.petugas?.unit?.nama || null,
    event: t.event,
    terlambat: idx === d.trackingLogs.length - 1 && isLate,
  }));

  return (
    <>
      <PageHeader
        title={`Tracking ${isMasuk ? "Surat Masuk" : "Surat Keluar"}`}
        subtitle={isMasuk ? d.nomorAgenda : d.nomorSurat}
        action={
          <Link href="/tracking" className="btn-secondary">
            <IconSearch className="h-4 w-4" /> Pencarian Baru
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
                <IconTracking className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
                  Kode Verifikasi
                </p>
                <p className="font-mono text-ink-900 font-medium">{d.kodeVerifikasi}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Info
                label={isMasuk ? "Nomor Agenda" : "Nomor Surat"}
                value={isMasuk ? d.nomorAgenda : d.nomorSurat}
              />
              {isMasuk && <Info label="Nomor Surat" value={d.nomorSurat} />}
              <Info label="Perihal" value={d.perihal} full />
              <Info
                label={isMasuk ? "Asal Surat" : "Tujuan"}
                value={isMasuk ? d.asalSurat : d.tujuan}
              />
              <Info
                label={isMasuk ? "Unit Tujuan" : "Unit Pembuat"}
                value={(isMasuk ? d.unitTujuan : d.unitPembuat)?.nama || "-"}
              />
              <Info label="Tanggal Surat" value={formatDate(d.tanggalSurat)} />
              <Info
                label="Dicatat Oleh"
                value={`${d.createdBy?.nama || "-"}${
                  d.createdBy?.jabatan ? ` · ${d.createdBy.jabatan}` : ""
                }`}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {isMasuk && (
                <>
                  <span className={`chip ${PRIORITAS_COLOR[d.prioritas as keyof typeof PRIORITAS_COLOR]}`}>{d.prioritas}</span>
                  <span className={`chip ${SURAT_MASUK_STATUS_COLOR[d.status as keyof typeof SURAT_MASUK_STATUS_COLOR]}`}>
                    {SURAT_MASUK_STATUS_LABEL[d.status as keyof typeof SURAT_MASUK_STATUS_LABEL]}
                  </span>
                </>
              )}
              {!isMasuk && (
                <span
                  className={`chip ${
                    SURAT_KELUAR_STATUS_COLOR[d.status as keyof typeof SURAT_KELUAR_STATUS_COLOR]
                  }`}
                >
                  {SURAT_KELUAR_STATUS_LABEL[d.status as keyof typeof SURAT_KELUAR_STATUS_LABEL]}
                </span>
              )}
              {isLate && (
                <span className="chip bg-red-50 text-red-700 ring-red-200">Terlambat</span>
              )}
              <Link
                href={isMasuk ? `/surat-masuk/${d.id}` : `/surat-keluar/${d.id}`}
                className="chip bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100"
              >
                Buka Detail →
              </Link>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-800 mb-4">Ringkasan Alur Dokumen</h3>
            <Timeline items={tlItems} current={tlItems.length - 1} orientation="horizontal" />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-800 mb-4">Riwayat Lengkap</h3>
          <Timeline items={tlItems} current={tlItems.length - 1} />

          <div className="mt-5 pt-4 border-t border-ink-200 text-xs text-ink-500">
            <p>Total {tlItems.length} aktivitas</p>
            <p className="mt-1">
              Terakhir diperbarui: {formatDateTime(tlItems[tlItems.length - 1]?.waktu)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Info({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </dt>
      <dd className="text-sm text-ink-900 mt-0.5 leading-relaxed">{value}</dd>
    </div>
  );
}
