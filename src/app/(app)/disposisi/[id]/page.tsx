import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canViewDisposisi } from "@/lib/security";
import { PageHeader } from "@/components/shell/PageHeader";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import DisposisiActions from "./actions";
import {
  DISPOSISI_STATUS_COLOR,
  DISPOSISI_STATUS_LABEL,
  INSTRUKSI_LABEL,
  PRIORITAS_COLOR,
} from "@/lib/constants";
import { formatDate, formatDateTime, humanBytes } from "@/lib/utils";
import {
  IconFile,
  IconDownload,
  IconArrowRight,
  IconTracking,
  IconClock,
} from "@/components/ui/Icons";

export const dynamic = "force-dynamic";

export default async function DisposisiDetail({
  params,
}: {
  params: { id: string };
}) {
  const session = (await getSession())!;

  const item = await prisma.disposisi.findUnique({
    where: { id: params.id },
    include: {
      suratMasuk: {
        include: {
          unitTujuan: true,
          createdBy: { select: { nama: true, jabatan: true } },
          attachments: true,
        },
      },
      fromUser: { select: { id: true, nama: true, jabatan: true, unit: true } },
      toUser: { select: { id: true, nama: true, jabatan: true, unit: true } },
      toUnit: true,
      parent: {
        include: {
          fromUser: { select: { nama: true, jabatan: true } },
          toUser: { select: { nama: true, jabatan: true } },
          toUnit: true,
        },
      },
      children: {
        orderBy: { createdAt: "asc" },
        include: {
          fromUser: { select: { nama: true, jabatan: true } },
          toUser: { select: { nama: true, jabatan: true } },
          toUnit: true,
        },
      },
      attachments: true,
      trackingLogs: {
        orderBy: { createdAt: "asc" },
        include: {
          petugas: { select: { nama: true, jabatan: true, unit: { select: { nama: true } } } },
        },
      },
    },
  });

  if (!item) notFound();
  if (!canViewDisposisi(session, item)) notFound();

  // Auto mark as read
  const isRecipient = item.toUserId === session.id;
  if (isRecipient && item.status === "BARU") {
    await prisma.disposisi.update({
      where: { id: item.id },
      data: { status: "DIBACA", dibacaPada: new Date() },
    });
    await prisma.trackingLog.create({
      data: {
        event: "DISPOSISI_DIBACA",
        judul: "Disposisi dibaca",
        petugasId: session.id,
        suratMasukId: item.suratMasukId,
        disposisiId: item.id,
      },
    });
  }

  const users = await prisma.user.findMany({
    where: { aktif: true, id: { not: session.id } },
    orderBy: { nama: "asc" },
    select: {
      id: true,
      nama: true,
      jabatan: true,
      unit: { select: { id: true, nama: true } },
    },
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
  }));

  const late =
    item.deadline &&
    new Date(item.deadline) < new Date() &&
    !["SELESAI", "DITOLAK"].includes(item.status);

  const isCreator = item.fromUserId === session.id;
  const isAdmin = session.role === "SUPER_ADMIN";
  const canAct = isRecipient || isCreator || isAdmin;

  return (
    <>
      <PageHeader
        title="Detail Disposisi"
        subtitle={item.suratMasuk.perihal}
        action={
          <>
            <Link href="/disposisi" className="btn-secondary">
              Kembali
            </Link>
            <Link
              href={`/surat-masuk/${item.suratMasukId}`}
              className="btn-secondary"
            >
              Buka Surat
            </Link>
            <Link
              href={`/tracking/${item.suratMasuk.kodeVerifikasi}`}
              className="btn-secondary"
            >
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
                  DISPOSISI_STATUS_COLOR[item.status]
                } ${late ? "ring-red-300" : ""}`}
              >
                {DISPOSISI_STATUS_LABEL[item.status]}
              </span>
              <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                {INSTRUKSI_LABEL[item.instruksi]}
              </span>
              {late && (
                <span className="chip bg-red-50 text-red-700 ring-red-200 animate-pulse">
                  Terlambat
                </span>
              )}
              <span
                className={`chip ${PRIORITAS_COLOR[item.suratMasuk.prioritas]}`}
              >
                Prioritas: {item.suratMasuk.prioritas}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <InfoBox label="Dari" value={item.fromUser.nama} sub={item.fromUser.jabatan || item.fromUser.unit?.nama} />
              <InfoBox
                label="Kepada"
                value={item.toUser?.nama || item.toUnit?.nama || "-"}
                sub={item.toUser?.jabatan || item.toUnit?.deskripsi || null}
              />
              <InfoBox
                label="Tanggal Dikirim"
                value={formatDateTime(item.createdAt)}
              />
              <InfoBox
                label="Deadline"
                value={item.deadline ? formatDate(item.deadline) : "Tidak ditentukan"}
                sub={
                  item.deadline
                    ? late
                      ? "Sudah melewati deadline"
                      : `${Math.ceil(
                          (new Date(item.deadline).getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                        )} hari tersisa`
                    : null
                }
                tone={late ? "red" : undefined}
              />
            </div>

            {item.catatan && (
              <div className="rounded-xl bg-brand-50/50 ring-1 ring-brand-200 p-4 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-800 mb-1">
                  Catatan & Instruksi
                </p>
                <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">
                  {item.catatan}
                </p>
              </div>
            )}

            {item.buktiCatatan && (
              <div className="rounded-xl bg-emerald-50/50 ring-1 ring-emerald-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-1">
                  Catatan Tindak Lanjut
                </p>
                <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">
                  {item.buktiCatatan}
                </p>
              </div>
            )}
          </div>

          {/* Surat terkait */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-800 mb-3">
              Surat Terkait
            </h3>
            <Link
              href={`/surat-masuk/${item.suratMasuk.id}`}
              className="block rounded-xl ring-1 ring-ink-200 p-4 hover:ring-brand-300 transition"
            >
              <p className="font-mono text-xs text-ink-500">
                {item.suratMasuk.nomorAgenda}
              </p>
              <p className="font-medium text-ink-900 mt-0.5">
                {item.suratMasuk.perihal}
              </p>
              <p className="text-xs text-ink-600 mt-1">
                {item.suratMasuk.asalSurat} · {formatDate(item.suratMasuk.tanggalSurat)}
              </p>
            </Link>
          </div>

          {/* Bukti attachments */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-800 mb-3">
              Bukti Tindak Lanjut
            </h3>
            {item.attachments.length === 0 ? (
              <p className="text-sm text-ink-500 italic">
                Belum ada bukti tindak lanjut yang diunggah.
              </p>
            ) : (
              <ul className="divide-y divide-ink-200/70">
                {item.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <IconFile className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-800 font-medium truncate">{a.nama}</p>
                      <p className="text-xs text-ink-500">
                        {humanBytes(a.ukuran)} · {a.mime}
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
          </div>

          {/* Chain disposisi */}
          {(item.parent || item.children.length > 0) && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink-800 mb-3">
                Alur Disposisi
              </h3>
              <div className="space-y-2 text-sm">
                {item.parent && (
                  <Link
                    href={`/disposisi/${item.parent.id}`}
                    className="flex items-center gap-2 rounded-lg ring-1 ring-ink-200 px-3 py-2 hover:bg-brand-50/40"
                  >
                    <span className="text-xs text-ink-500">Dari</span>
                    <span className="font-medium">{item.parent.fromUser.nama}</span>
                    <IconArrowRight className="h-3.5 w-3.5 text-ink-400" />
                    <span className="font-medium">
                      {item.parent.toUser?.nama || item.parent.toUnit?.nama || "-"}
                    </span>
                    <span
                      className={`chip ml-auto ${
                        DISPOSISI_STATUS_COLOR[item.parent.status]
                      }`}
                    >
                      {DISPOSISI_STATUS_LABEL[item.parent.status]}
                    </span>
                  </Link>
                )}
                {item.children.map((c) => (
                  <Link
                    key={c.id}
                    href={`/disposisi/${c.id}`}
                    className="flex items-center gap-2 rounded-lg ring-1 ring-ink-200 px-3 py-2 hover:bg-brand-50/40"
                  >
                    <span className="text-xs text-ink-500">Diteruskan</span>
                    <span className="font-medium">{c.fromUser.nama}</span>
                    <IconArrowRight className="h-3.5 w-3.5 text-ink-400" />
                    <span className="font-medium">
                      {c.toUser?.nama || c.toUnit?.nama || "-"}
                    </span>
                    <span
                      className={`chip ml-auto ${
                        DISPOSISI_STATUS_COLOR[c.status]
                      }`}
                    >
                      {DISPOSISI_STATUS_LABEL[c.status]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="space-y-5">
          {canAct && (
            <DisposisiActions
              id={item.id}
              status={item.status}
              isRecipient={isRecipient}
              isCreator={isCreator}
              suratMasukId={item.suratMasukId}
              users={users}
              units={units}
            />
          )}

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-800 mb-4 flex items-center gap-2">
              <IconClock className="h-4 w-4 text-ink-500" /> Timeline
            </h3>
            <Timeline items={tlItems} current={tlItems.length - 1} />
          </div>
        </div>
      </div>
    </>
  );
}

function InfoBox({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string | null;
  tone?: "red";
}) {
  return (
    <div className="rounded-xl ring-1 ring-ink-200 p-3.5">
      <p className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </p>
      <p
        className={`text-sm font-medium mt-0.5 ${
          tone === "red" ? "text-red-700" : "text-ink-900"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}
