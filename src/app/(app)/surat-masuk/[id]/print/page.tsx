import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { INSTRUKSI_LABEL, PRIORITAS_OPTIONS } from "@/lib/constants";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

export default async function LembarDisposisiPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) return null;
  const allowed = await (async () => {
    const { canViewSuratMasuk } = await import("@/lib/security");
    return canViewSuratMasuk(session, params.id);
  })();
  if (!allowed) notFound();

  const item = await prisma.suratMasuk.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      unitTujuan: true,
      createdBy: { select: { nama: true, jabatan: true } },
      disposisi: {
        orderBy: { createdAt: "asc" },
        include: {
          fromUser: { select: { nama: true, jabatan: true } },
          toUser: { select: { nama: true, jabatan: true } },
          toUnit: true,
        },
      },
    },
  });
  if (!item) notFound();

  const prioritasLabel =
    PRIORITAS_OPTIONS.find((p) => p.value === item.prioritas)?.label || item.prioritas;

  const qrSrc = `/api/qr/${encodeURIComponent(item.kodeVerifikasi)}`;

  return (
    <div className="min-h-screen bg-ink-100 py-8 px-4">
      <div className="no-print max-w-[800px] mx-auto mb-4 flex items-center justify-between">
        <a href={`/surat-masuk/${item.id}`} className="btn-secondary text-sm">
          ← Kembali
        </a>
        <PrintButton />
      </div>
      <div
        className="print-page bg-white shadow-card ring-1 ring-ink-200 max-w-[800px] mx-auto px-10 py-8 text-[13px] text-ink-900"
        style={{ minHeight: "29.7cm" }}
      >
        <header className="flex items-start gap-5 pb-4 border-b-[3px] border-brand-800">
          <div className="h-16 w-16 rounded-full bg-brand-700 text-white flex items-center justify-center text-xl font-semibold shrink-0">
            T
          </div>
          <div className="flex-1">
            <p className="text-[10px] tracking-[0.18em] uppercase text-ink-500">
              Perusahaan Umum Daerah Air Minum
            </p>
            <p className="text-xl font-bold text-brand-900 leading-tight">
              Tirta Ardhia Rinjani
            </p>
            <p className="text-xs text-ink-600 mt-0.5">
              Kabupaten Lombok Tengah · Provinsi Nusa Tenggara Barat
            </p>
          </div>
          <img
            src={qrSrc}
            alt="QR"
            className="h-24 w-24 rounded ring-1 ring-ink-200"
          />
        </header>

        <h1 className="text-center text-base font-bold tracking-wide uppercase mt-5 mb-4">
          Lembar Disposisi
        </h1>

        <table className="w-full border border-ink-300 text-[12px] leading-tight">
          <tbody>
            <Row label="Nomor Agenda" value={<span className="font-mono">{item.nomorAgenda}</span>} />
            <Row label="Nomor Surat" value={item.nomorSurat} />
            <Row label="Tanggal Surat" value={formatDate(item.tanggalSurat)} />
            <Row label="Tanggal Diterima" value={formatDate(item.tanggalDiterima)} />
            <Row label="Asal Surat" value={item.asalSurat} />
            <Row label="Perihal" value={item.perihal} />
            <Row label="Ringkasan" value={item.ringkasan || "-"} />
            <Row label="Prioritas" value={prioritasLabel} />
            <Row label="Unit Tujuan" value={item.unitTujuan?.nama || "-"} />
          </tbody>
        </table>

        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700 mb-2">
            Disposisi
          </p>
          {item.disposisi.length === 0 ? (
            <div className="h-40 border border-dashed border-ink-300 rounded flex items-center justify-center text-ink-400 italic text-xs">
              Ruang kosong untuk disposisi manual
            </div>
          ) : (
            <table className="w-full border border-ink-300 text-[11.5px]">
              <thead className="bg-ink-50">
                <tr>
                  <th className="border border-ink-300 px-2 py-1.5 text-left">Tanggal</th>
                  <th className="border border-ink-300 px-2 py-1.5 text-left">Dari</th>
                  <th className="border border-ink-300 px-2 py-1.5 text-left">Kepada</th>
                  <th className="border border-ink-300 px-2 py-1.5 text-left">Instruksi</th>
                  <th className="border border-ink-300 px-2 py-1.5 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {item.disposisi.map((d) => (
                  <tr key={d.id}>
                    <td className="border border-ink-300 px-2 py-1.5 align-top whitespace-nowrap">
                      {formatDate(d.createdAt, true)}
                    </td>
                    <td className="border border-ink-300 px-2 py-1.5 align-top">
                      {d.fromUser.nama}
                    </td>
                    <td className="border border-ink-300 px-2 py-1.5 align-top">
                      {d.toUser?.nama || d.toUnit?.nama || "-"}
                    </td>
                    <td className="border border-ink-300 px-2 py-1.5 align-top">
                      {INSTRUKSI_LABEL[d.instruksi]}
                    </td>
                    <td className="border border-ink-300 px-2 py-1.5 align-top">
                      {d.catatan || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-10">
          <div className="text-xs text-ink-600">
            <p className="uppercase tracking-wider text-[10px] mb-1">
              Kode Verifikasi
            </p>
            <p className="font-mono text-ink-900">{item.kodeVerifikasi}</p>
            <p className="mt-2 text-[11px] leading-relaxed">
              Dokumen dapat diverifikasi melalui URL:
              <br />
              <span className="font-mono">
                {(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/verify/{item.kodeVerifikasi}
              </span>
            </p>
          </div>
          <div className="text-right text-xs">
            <p>{formatDate(new Date())}</p>
            <p className="mt-1">Sekretariat Perusahaan</p>
            <div className="h-16" />
            <p className="font-semibold border-t border-ink-400 pt-1 inline-block px-6">
              {item.createdBy?.nama || "-"}
            </p>
          </div>
        </div>

        <footer className="mt-8 pt-3 border-t border-ink-200 text-center text-[10px] text-ink-500">
          E-Office TIARA · PERUMDAM Tirta Ardhia Rinjani · Lombok Tengah
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th className="border border-ink-300 bg-ink-50 px-3 py-2 text-left font-semibold w-[180px] align-top">
        {label}
      </th>
      <td className="border border-ink-300 px-3 py-2 align-top">{value}</td>
    </tr>
  );
}
