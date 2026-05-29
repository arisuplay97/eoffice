import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canCreateDisposisi, canInputSuratMasuk } from "@/lib/auth";
import { canViewSuratMasuk } from "@/lib/security";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import SuratMasukDetailActions from "./detail-actions";
import { AttachmentUpload } from "@/components/attachment-upload";
import {
  PRIORITAS_COLOR,
  SURAT_MASUK_STATUS_COLOR,
  SURAT_MASUK_STATUS_LABEL,
  DISPOSISI_STATUS_LABEL,
  DISPOSISI_STATUS_COLOR,
  INSTRUKSI_LABEL,
} from "@/lib/constants";
import { formatDate, formatDateTime, humanBytes } from "@/lib/utils";
import {
  IconFile,
  IconPrinter,
  IconDownload,
  IconDisposisi,
  IconTracking,
  IconArrowRight,
} from "@/components/ui/Icons";

export const dynamic = "force-dynamic";

export default async function SuratMasukDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = (await getSession())!;
  const allowed = await canViewSuratMasuk(session, params.id);
  if (!allowed) notFound();

  const item = await prisma.suratMasuk.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      unitTujuan: true,
      createdBy: { select: { nama: true, jabatan: true } },
      attachments: { where: { deletedAt: null } },
      disposisi: {
        orderBy: { createdAt: "asc" },
        include: {
          fromUser: { select: { id: true, nama: true, jabatan: true } },
          toUser: { select: { id: true, nama: true, jabatan: true } },
          toUnit: true,
        },
      },
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: {
          petugas: { select: { nama: true, jabatan: true, unit: { select: { nama: true } } } },
        },
      },
    },
  });
  if (!item) notFound();

  const users = await prisma.user.findMany({
    where: { aktif: true, id: { not: session.id } },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, jabatan: true, role: true, unit: { select: { id: true, nama: true } } },
  });
  const units = await prisma.unit.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });

  const tlItems: TimelineItem[] = item.trackingLogs.map((t) => ({
    id: t.id,
    judul: t.judul,
    keterangan: t.keterangan,
    waktu: t.createdAt,
    oleh: t.petugas?.nama || "Sistem",
    unit: t.petugas?.unit?.nama || null,
    event: t.event,
  }));

  return (
    <>
      <PageHeader
        title={item.nomorAgenda}
        subtitle={item.perihal}
        action={
          <>
            <Link href="/surat-masuk" className="btn-secondary">
              Kembali
            </Link>
            <Link href={`/tracking/${item.kodeVerifikasi}`} className="btn-secondary">
              <IconTracking className="h-4 w-4" /> Tracking
            </Link>
            <Link
              href={`/surat-masuk/${item.id}/print`}
              target="_blank"
              className="btn-secondary"
            >
              <IconPrinter className="h-4 w-4" /> Lembar Disposisi
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Info & disposisi */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`chip ${PRIORITAS_COLOR[item.prioritas]}`}>
                {item.prioritas}
              </span>
              <span className={`chip ${SURAT_MASUK_STATUS_COLOR[item.status]}`}>
                {SURAT_MASUK_STATUS_LABEL[item.status]}
              </span>
              <span className="chip bg-slate-100 text-slate-700 ring-slate-200">
                Kode: {item.kodeVerifikasi}
              </span>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Nomor Surat" value={item.nomorSurat} />
              <InfoRow label="Tanggal Surat" value={formatDate(item.tanggalSurat)} />
              <InfoRow label="Tanggal Diterima" value={formatDate(item.tanggalDiterima)} />
              <InfoRow label="Asal Surat" value={item.asalSurat} />
              <InfoRow label="Unit Tujuan" value={item.unitTujuan?.nama || "-"} />
              <InfoRow
                label="Dicatat oleh"
                value={`${item.createdBy?.nama || "-"}${item.createdBy?.jabatan ? ` · ${item.createdBy.jabatan}` : ""}`}
              />
              <InfoRow full label="Perihal" value={item.perihal} />
              <InfoRow full label="Ringkasan" value={item.ringkasan || "-"} />
              {item.catatan && <InfoRow full label="Catatan Sekretariat" value={item.catatan} />}
            </dl>
          </div>

          {/* Attachments */}
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
                      <p className="text-xs text-ink-500">{humanBytes(a.ukuran)} · {a.mime}</p>
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
            {canInputSuratMasuk(session.role) && (
              <AttachmentUpload suratId={item.id} suratType="surat-masuk" />
            )}
          </div>

          {/* Disposisi list */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink-800">Disposisi</h3>
              <p className="text-xs text-ink-500">
                {item.disposisi.length} disposisi
              </p>
            </div>
            {item.disposisi.length === 0 ? (
              <p className="text-sm text-ink-500 italic py-4">
                Belum ada disposisi untuk surat ini.
              </p>
            ) : (
              <div className="space-y-3">
                {item.disposisi.map((d) => (
                  <Link
                    key={d.id}
                    href={`/disposisi/${d.id}`}
                    className="block rounded-xl ring-1 ring-ink-200 p-4 hover:ring-brand-300 hover:bg-brand-50/20 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-ink-500">
                          {formatDateTime(d.createdAt)}
                        </p>
                        <p className="mt-1 text-sm text-ink-800">
                          <span className="font-medium">{d.fromUser.nama}</span>
                          <IconArrowRight className="inline h-3.5 w-3.5 mx-1.5 text-ink-400" />
                          <span className="font-medium">
                            {d.toUser?.nama || d.toUnit?.nama || "-"}
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                            {INSTRUKSI_LABEL[d.instruksi]}
                          </span>
                          <span className={`chip ${DISPOSISI_STATUS_COLOR[d.status]}`}>
                            {DISPOSISI_STATUS_LABEL[d.status]}
                          </span>
                          {d.deadline && (
                            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">
                              Deadline: {formatDate(d.deadline)}
                            </span>
                          )}
                        </div>
                        {d.catatan && (
                          <p className="mt-2 text-sm text-ink-600 line-clamp-2">
                            {d.catatan}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & timeline */}
        <div className="space-y-5">
          {canCreateDisposisi(session.role) && item.status !== "DIARSIPKAN" && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink-800 mb-3 flex items-center gap-2">
                <IconDisposisi className="h-4 w-4 text-brand-700" />
                Buat Disposisi
              </h3>
              <SuratMasukDetailActions
                suratId={item.id}
                users={users}
                units={units}
                canArchive={
                  session.role === "SUPER_ADMIN" ||
                  session.role === "SEKRETARIAT"
                }
                currentStatus={item.status}
                kode={item.kodeVerifikasi}
              />
            </div>
          )}

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-800 mb-4">Timeline</h3>
            <Timeline items={tlItems} current={tlItems.length - 1} />
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({
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
