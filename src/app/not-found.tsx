import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink-50 px-4">
      <div className="max-w-md text-center">
        <p className="text-[72px] font-bold text-brand-700 leading-none tabular-nums">404</p>
        <h1 className="text-xl font-semibold text-ink-900 mt-2">
          Halaman Tidak Ditemukan
        </h1>
        <p className="text-sm text-ink-500 mt-2">
          Halaman yang Anda cari tidak tersedia atau telah dipindahkan.
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <Link href="/dashboard" className="btn-primary">
            Ke Dashboard
          </Link>
          <Link href="/verify" className="btn-secondary">
            Verifikasi Dokumen
          </Link>
        </div>
      </div>
    </div>
  );
}
