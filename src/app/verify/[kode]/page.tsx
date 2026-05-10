import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySignatureHash } from "@/lib/codes";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  SURAT_MASUK_STATUS_LABEL,
  SURAT_KELUAR_STATUS_LABEL,
} from "@/lib/constants";
import {
  IconCheck,
  IconWarning,
  IconDroplet,
  IconShield,
  IconTracking,
} from "@/components/ui/Icons";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Verifikasi Dokumen - E-Office TIARA",
  // Mencegah halaman verifikasi kode spesifik diindeks search engine.
  robots: { index: false, follow: false },
};

// Format kode yang diterima: TIARA-YYYYMMDD-XXXXXX (hex uppercase)
// Tolak input selain pattern ini untuk menghindari enumerasi / IDOR dari ID DB.
const KODE_PATTERN = /^TIARA-\d{8}-[A-F0-9]{6}$/;

function scrubRingkasan(s: string | null): string | null {
  if (!s) return null;
  // Halaman publik hanya tampilkan ringkasan singkat (dipotong) — cegah data leakage.
  const trimmed = s.trim();
  if (trimmed.length <= 120) return trimmed;
  return trimmed.slice(0, 117) + "...";
}

async function verify(kode: string) {
  if (!KODE_PATTERN.test(kode)) return null;

  const sm = await prisma.suratMasuk.findFirst({
    where: { kodeVerifikasi: kode, deletedAt: null },
    include: {
      unitTujuan: { select: { nama: true } },
      trackingLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        // Jangan expose nama petugas / unit internal secara detail — cukup judul & waktu.
        select: { judul: true, createdAt: true },
      },
    },
  });
  if (sm) {
    const valid = verifySignatureHash(
      `${sm.nomorAgenda}|${sm.kodeVerifikasi}`,
      sm.signatureHash
    );
    // Dokumen yang diarsipkan tetap valid. Untuk rahasia, tampilkan metadata minimal.
    const isRahasia = sm.prioritas === "RAHASIA";
    return {
      valid,
      jenis: "Surat Masuk",
      nomor: sm.nomorAgenda,
      nomorSurat: sm.nomorSurat,
      tanggal: sm.tanggalSurat,
      perihal: isRahasia ? "[Dirahasiakan]" : sm.perihal,
      unit: sm.unitTujuan?.nama || null,
      statusLabel: SURAT_MASUK_STATUS_LABEL[sm.status],
      kode: sm.kodeVerifikasi,
      trackingTerakhir: sm.trackingLogs[0] || null,
      rahasia: isRahasia,
    };
  }

  const sk = await prisma.suratKeluar.findFirst({
    where: { kodeVerifikasi: kode, deletedAt: null },
    include: {
      unitPembuat: { select: { nama: true } },
      trackingLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { judul: true, createdAt: true },
      },
    },
  });
  if (sk) {
    const valid = verifySignatureHash(
      `${sk.nomorSurat}|${sk.kodeVerifikasi}`,
      sk.signatureHash
    );
    // Surat dengan status DRAFT / MENUNGGU_PARAF / MENUNGGU_TTD belum sah — jangan expose.
    const isFinal = sk.status === "TERKIRIM" || sk.status === "DIARSIPKAN";
    return {
      valid: valid && isFinal,
      jenis: "Surat Keluar",
      nomor: sk.nomorSurat,
      nomorSurat: null,
      tanggal: sk.tanggalSurat,
      perihal: sk.perihal,
      unit: sk.unitPembuat?.nama || null,
      statusLabel:
        SURAT_KELUAR_STATUS_LABEL[sk.status as keyof typeof SURAT_KELUAR_STATUS_LABEL],
      kode: sk.kodeVerifikasi,
      trackingTerakhir: sk.trackingLogs[0] || null,
      rahasia: false,
    };
  }

  return null;
}

export default async function VerifyDetailPage({
  params,
}: {
  params: { kode: string };
}) {
  const kode = decodeURIComponent(params.kode).toUpperCase();
  const result = await verify(kode);

  // Audit publik (tanpa userId) — hanya simpan kode yang tervalidasi formatnya.
  if (KODE_PATTERN.test(kode)) {
    await audit({
      action: "QR_VERIFY_OPENED",
      description: result?.valid ? "Verifikasi berhasil" : "Verifikasi gagal/tidak ditemukan",
      metadata: { kode, found: !!result, valid: !!result?.valid },
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
      <Header />

      {!result || !result.valid ? (
        <div className="card p-8 sm:p-10 text-center ring-red-200">
          <div className="relative mx-auto h-20 w-20 mb-5">
            <div className="absolute inset-0 rounded-full bg-red-100 animate-pulseDot" />
            <div className="relative h-20 w-20 rounded-full bg-red-500 text-white flex items-center justify-center">
              <IconWarning className="h-9 w-9" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-ink-900">
            Dokumen Tidak Valid / Tidak Ditemukan
          </h1>
          <p className="mt-2 text-sm text-ink-600 max-w-md mx-auto leading-relaxed">
            Kode verifikasi yang Anda masukkan tidak terdaftar di sistem
            E-Office TIARA, atau dokumen belum sah/tidak aktif.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/verify" className="btn-primary">
              Coba Kode Lain
            </Link>
            <Link href="/login" className="btn-secondary">
              Masuk ke E-Office TIARA
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-8 sm:p-10 ring-emerald-200">
          <div className="text-center">
            <div className="relative mx-auto h-20 w-20 mb-5">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-pulseDot" />
              <div className="relative h-20 w-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                <IconCheck className="h-10 w-10" strokeWidth={3} />
              </div>
            </div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-emerald-700">
              Dokumen Terverifikasi & Sah
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-ink-900 mt-1.5">
              {result.perihal}
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              {result.jenis} · {formatDate(result.tanggal)}
            </p>
          </div>

          <dl className="mt-8 divide-y divide-ink-200 ring-1 ring-ink-200 rounded-xl overflow-hidden text-sm">
            <Row label="Nomor" value={<span className="font-mono">{result.nomor}</span>} />
            {result.nomorSurat && !result.rahasia && (
              <Row label="Nomor Surat Asli" value={result.nomorSurat} />
            )}
            <Row label="Jenis Dokumen" value={result.jenis} />
            <Row label="Unit / Bidang" value={result.unit || "-"} />
            <Row label="Tanggal" value={formatDate(result.tanggal)} />
            <Row
              label="Status"
              value={
                <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">
                  {result.statusLabel}
                </span>
              }
            />
            <Row
              label="Kode Verifikasi"
              value={<span className="font-mono">{result.kode}</span>}
            />
          </dl>

          {result.trackingTerakhir && (
            <div className="mt-6 rounded-xl bg-brand-50/60 ring-1 ring-brand-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-800 mb-2">
                Tracking Terakhir
              </p>
              <p className="text-sm font-medium text-ink-900">
                {result.trackingTerakhir.judul}
              </p>
              <p className="text-xs text-ink-600 mt-1">
                {formatDateTime(result.trackingTerakhir.createdAt)}
              </p>
            </div>
          )}

          <div className="mt-6 rounded-lg bg-ink-50 ring-1 ring-ink-200 p-3 text-[11px] text-ink-600 leading-relaxed">
            Halaman ini menampilkan ringkasan metadata dokumen. Dokumen asli
            hanya dapat diakses oleh pihak berwenang yang login ke E-Office TIARA.
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/verify" className="btn-secondary">
              Verifikasi Lain
            </Link>
            <Link href="/login" className="btn-primary">
              Masuk untuk detail lengkap
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-ink-200 text-center text-[11px] text-ink-500 flex items-center justify-center gap-1.5">
            <IconShield className="h-3.5 w-3.5" />
            Divalidasi dengan signature HMAC-SHA256
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-ink-500 mt-6 leading-relaxed">
        E-Office TIARA · PERUMDAM Tirta Ardhia Rinjani · Lombok Tengah
      </p>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3 justify-center mb-8">
      <div className="h-12 w-12 rounded-2xl bg-brand-700 text-white flex items-center justify-center shadow-sm">
        <IconDroplet className="h-6 w-6" />
      </div>
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-500">
          PERUMDAM
        </p>
        <p className="text-base font-semibold text-ink-900 leading-tight">
          Tirta Ardhia Rinjani
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3 bg-white">
      <dt className="w-40 shrink-0 text-xs uppercase tracking-wider text-ink-500 font-semibold pt-0.5">
        {label}
      </dt>
      <dd className="text-sm text-ink-900 leading-relaxed flex-1">{value}</dd>
    </div>
  );
}
