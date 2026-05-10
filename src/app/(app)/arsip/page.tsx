import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell/PageHeader";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import ArsipFilterClient from "./filter-client";
import {
  PRIORITAS_COLOR,
  SURAT_MASUK_STATUS_COLOR,
  SURAT_MASUK_STATUS_LABEL,
  SURAT_KELUAR_STATUS_COLOR,
  SURAT_KELUAR_STATUS_LABEL,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { IconDownload, IconFile } from "@/components/ui/Icons";

export const dynamic = "force-dynamic";

export default async function ArsipPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    jenis?: "masuk" | "keluar";
    tahun?: string;
    bulan?: string;
    unitId?: string;
  };
}) {
  const jenis = (searchParams?.jenis as "masuk" | "keluar") || "masuk";
  const q = searchParams?.q?.trim() || "";
  const tahun = searchParams?.tahun ? Number(searchParams.tahun) : undefined;
  const bulan = searchParams?.bulan ? Number(searchParams.bulan) : undefined;
  const unitId = searchParams?.unitId;

  const units = await prisma.unit.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });

  const where: any = { deletedAt: null };
  if (tahun || bulan) {
    const y = tahun || new Date().getFullYear();
    const m = bulan ? bulan - 1 : 0;
    const start = bulan ? new Date(y, m, 1) : new Date(y, 0, 1);
    const end = bulan ? new Date(y, m + 1, 1) : new Date(y + 1, 0, 1);
    where.tanggalSurat = { gte: start, lt: end };
  }

  if (q) {
    if (jenis === "masuk") {
      where.OR = [
        { nomorAgenda: { contains: q, mode: "insensitive" } },
        { nomorSurat: { contains: q, mode: "insensitive" } },
        { asalSurat: { contains: q, mode: "insensitive" } },
        { perihal: { contains: q, mode: "insensitive" } },
      ];
    } else {
      where.OR = [
        { nomorSurat: { contains: q, mode: "insensitive" } },
        { tujuan: { contains: q, mode: "insensitive" } },
        { perihal: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  if (unitId) {
    if (jenis === "masuk") where.unitTujuanId = unitId;
    else where.unitPembuatId = unitId;
  }

  const items =
    jenis === "masuk"
      ? await prisma.suratMasuk.findMany({
          where,
          orderBy: { tanggalSurat: "desc" },
          take: 200,
          include: {
            unitTujuan: { select: { nama: true } },
            attachments: { select: { id: true, nama: true, url: true } },
            _count: { select: { attachments: true } },
          },
        })
      : await prisma.suratKeluar.findMany({
          where,
          orderBy: { tanggalSurat: "desc" },
          take: 200,
          include: {
            unitPembuat: { select: { nama: true } },
            attachments: { select: { id: true, nama: true, url: true } },
            _count: { select: { attachments: true } },
          },
        });

  const total =
    jenis === "masuk"
      ? await prisma.suratMasuk.count({ where })
      : await prisma.suratKeluar.count({ where });

  const exportHref = (() => {
    const params = new URLSearchParams();
    params.set("jenis", jenis);
    if (tahun) params.set("tahun", String(tahun));
    return `/api/arsip/export?${params.toString()}`;
  })();

  return (
    <>
      <PageHeader
        title="Arsip Digital"
        subtitle="Kumpulan surat masuk dan keluar yang tersimpan dalam sistem."
        action={
          <Link href={exportHref} className="btn-primary">
            <IconDownload className="h-4 w-4" /> Export Excel
          </Link>
        }
      />

      <ArsipFilterClient
        units={units}
        initial={{
          q,
          jenis,
          tahun: tahun ? String(tahun) : "",
          bulan: bulan ? String(bulan) : "",
          unitId: unitId || "",
        }}
      />

      {items.length === 0 ? (
        <Empty
          title="Arsip kosong"
          description="Tidak ada dokumen yang sesuai dengan kriteria pencarian."
        />
      ) : (
        <>
          <div className="mb-3 text-xs text-ink-500">
            Menampilkan {items.length} dari total {total} dokumen{" "}
            {jenis === "masuk" ? "surat masuk" : "surat keluar"}.
          </div>
          <Table>
            <THead>
              <tr>
                <TH>Nomor</TH>
                <TH>{jenis === "masuk" ? "Asal / Perihal" : "Tujuan / Perihal"}</TH>
                <TH>{jenis === "masuk" ? "Prioritas" : "Penandatangan"}</TH>
                <TH>Unit</TH>
                <TH>Status</TH>
                <TH>Tgl. Surat</TH>
                <TH>Berkas</TH>
                <TH className="text-right">Aksi</TH>
              </tr>
            </THead>
            <tbody>
              {items.map((r: any) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">
                    {jenis === "masuk" ? r.nomorAgenda : r.nomorSurat}
                    {jenis === "masuk" && (
                      <p className="text-[11px] text-ink-500 mt-0.5">{r.nomorSurat}</p>
                    )}
                  </TD>
                  <TD>
                    <div className="max-w-sm">
                      <p className="font-medium text-ink-900 line-clamp-1">
                        {r.perihal}
                      </p>
                      <p className="text-xs text-ink-500 line-clamp-1">
                        {jenis === "masuk" ? r.asalSurat : r.tujuan}
                      </p>
                    </div>
                  </TD>
                  <TD>
                    {jenis === "masuk" ? (
                      <span className={`chip ${PRIORITAS_COLOR[r.prioritas as keyof typeof PRIORITAS_COLOR]}`}>
                        {r.prioritas}
                      </span>
                    ) : (
                      <span className="text-xs">{r.penandatangan}</span>
                    )}
                  </TD>
                  <TD className="text-xs">
                    {jenis === "masuk"
                      ? r.unitTujuan?.nama || "-"
                      : r.unitPembuat?.nama || "-"}
                  </TD>
                  <TD>
                    {jenis === "masuk" ? (
                      <span
                        className={`chip ${SURAT_MASUK_STATUS_COLOR[r.status as keyof typeof SURAT_MASUK_STATUS_COLOR]}`}
                      >
                        {SURAT_MASUK_STATUS_LABEL[r.status as keyof typeof SURAT_MASUK_STATUS_LABEL]}
                      </span>
                    ) : (
                      <span
                        className={`chip ${SURAT_KELUAR_STATUS_COLOR[r.status as keyof typeof SURAT_KELUAR_STATUS_COLOR]}`}
                      >
                        {SURAT_KELUAR_STATUS_LABEL[r.status as keyof typeof SURAT_KELUAR_STATUS_LABEL]}
                      </span>
                    )}
                  </TD>
                  <TD className="text-xs text-ink-500">{formatDate(r.tanggalSurat)}</TD>
                  <TD>
                    {r.attachments.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <IconFile className="h-3.5 w-3.5 text-ink-400" />
                        <span className="text-xs">{r.attachments.length} berkas</span>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">-</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {r.attachments[0] && (
                        <a
                          href={`/api/files/${r.attachments[0].id}?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-700 hover:text-brand-800 text-xs font-medium"
                        >
                          Download
                        </a>
                      )}
                      <Link
                        href={
                          jenis === "masuk"
                            ? `/surat-masuk/${r.id}`
                            : `/surat-keluar/${r.id}`
                        }
                        className="text-brand-700 hover:text-brand-800 text-xs font-medium"
                      >
                        Detail →
                      </Link>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
