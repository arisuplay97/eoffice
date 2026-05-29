import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canInputSuratKeluar } from "@/lib/auth";
import { canViewSuratKeluar } from "@/lib/security";
import { PageHeader } from "@/components/shell/PageHeader";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import {
  SURAT_KELUAR_STATUS_COLOR,
  SURAT_KELUAR_STATUS_LABEL,
} from "@/lib/constants";
import { formatDate, formatDateTime, humanBytes } from "@/lib/utils";
import { IconFile, IconDownload, IconTracking } from "@/components/ui/Icons";
import StatusForm from "./status-form";
import { BsreSignAction } from "./sign-action";
import { AttachmentUpload } from "@/components/attachment-upload";

export const dynamic = "force-dynamic";

export default async function SuratKeluarDetail({ params }: { params: { id: string } }) {
  const session = (await getSession())!;
  const item = await prisma.suratKeluar.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      unitPembuat: true,
      createdBy: { select: { nama: true, jabatan: true } },
      attachments: { where: { deletedAt: null } },
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: {
          petugas: { select: { nama: true, jabatan: true, unit: { select: { nama: true } } } },
        },
      },
    },
  });
  if (!item) notFound();
  if (!canViewSuratKeluar(session, item)) notFound();

  const tlItems: TimelineItem[] = item.trackingLogs.map((t) => ({
    id: t.id,
    judul: t.judul,
    keterangan: t.keterangan,
    waktu: t.createdAt,
    oleh: t.petugas?.nama || "Sistem",
    unit: t.petugas?.unit?.nama || null,
  }));

  return (
    <>
      <PageHeader
        title={item.nomorSurat}
        subtitle={item.perihal}
        action={
          <>
            <Link href="/surat-keluar" className="btn-secondary">
              Kembali
            </Link>
            <Link href={`/tracking/${item.kodeVerifikasi}`} className="btn-secondary">
              <IconTracking className="h-4 w-4" /> Tracking
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span
                className={`chip ${
                  SURAT_KELUAR_STATUS_COLOR[item.status as keyof typeof SURAT_KELUAR_STATUS_COLOR]
                }`}
              >
                {SURAT_KELUAR_STATUS_LABEL[item.status as keyof typeof SURAT_KELUAR_STATUS_LABEL]}
              </span>
              <span className="chip bg-slate-100 text-slate-700 ring-slate-200">
                Kode: {item.kodeVerifikasi}
              </span>
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Tanggal Surat" value={formatDate(item.tanggalSurat)} />
              <Row label="Unit Pembuat" value={item.unitPembuat?.nama || "-"} />
              <Row label="Tujuan" value={item.tujuan} />
              <Row label="Penandatangan" value={item.penandatangan} />
              <Row
                label="Dibuat oleh"
                value={`${item.createdBy?.nama || "-"}${
                  item.createdBy?.jabatan ? ` · ${item.createdBy.jabatan}` : ""
                }`}
              />
              <Row label="Tgl. Dibuat" value={formatDateTime(item.createdAt)} />
              <Row full label="Perihal" value={item.perihal} />
              <Row full label="Ringkasan" value={item.ringkasan || "-"} />
              {item.catatan && <Row full label="Catatan" value={item.catatan} />}
            </dl>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-800">Lampiran Dokumen</h3>
              <p className="text-xs text-ink-500">{item.attachments.length} berkas</p>
            </div>
            {item.attachments.length === 0 ? (
              <p className="text-sm text-ink-500 italic">Belum ada lampiran.</p>
            ) : (
              <ul className="divide-y divide-ink-200/70">
                {item.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                      <IconFile className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-800 font-medium truncate">{a.nama}</p>
                      <p className="text-xs text-ink-500">
                        {humanBytes(a.ukuran)} · {a.mime} · {a.jenis || "file"}
                      </p>
                    </div>
                    <a
                      href={`/api/files/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost text-xs"
                    >
                      <IconDownload className="h-3.5 w-3.5" /> Lihat
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {canInputSuratKeluar(session.role) && (
              <AttachmentUpload suratId={item.id} suratType="surat-keluar" />
            )}
          </div>
        </div>

        <div className="space-y-5">
          {canInputSuratKeluar(session.role) && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink-800 mb-3">Update Status</h3>
              <StatusForm id={item.id} status={item.status} />
              
              {item.status === "MENUNGGU_TTD" && ["DIREKSI", "KEPALA_BAGIAN", "SUPER_ADMIN"].includes(session.role) && (
                <div className="mt-4 pt-4 border-t border-ink-200">
                  <h4 className="text-xs font-semibold text-ink-800 mb-2">Tanda Tangan Elektronik</h4>
                  {item.attachments.some(a => a.mime === "application/pdf") ? (
                    <BsreSignAction attachmentId={item.attachments.find(a => a.mime === "application/pdf")!.id} />
                  ) : (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                      Surat ini belum memiliki lampiran dokumen PDF. Unggah lampiran berformat PDF terlebih dahulu untuk melakukan tanda tangan elektronik (TTE BSrE).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-800">QR Verifikasi</h3>
            </div>
            <div className="flex items-center gap-4">
              <img
                src={`/api/qr/${encodeURIComponent(item.kodeVerifikasi)}`}
                alt="QR"
                className="h-32 w-32 rounded ring-1 ring-ink-200"
              />
              <div className="text-xs text-ink-600 leading-relaxed">
                <p className="font-mono text-ink-900">{item.kodeVerifikasi}</p>
                <p className="mt-1">
                  Scan untuk verifikasi dokumen di halaman publik.
                </p>
                <Link
                  href={`/verify/${item.kodeVerifikasi}`}
                  target="_blank"
                  className="text-brand-700 font-medium mt-1 inline-block"
                >
                  Buka halaman verifikasi →
                </Link>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-800 mb-4">Timeline</h3>
            <Timeline items={tlItems} current={tlItems.length - 1} />
          </div>
        </div>
      </div>
    </>
  );
}

function Row({
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
      <dt className="text-xs text-ink-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-ink-800 mt-0.5 leading-relaxed">{value}</dd>
    </div>
  );
}
