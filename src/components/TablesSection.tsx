"use client";

import React, { useState } from "react";
import {
  Clock,
  ArrowRightLeft,
  Eye,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { STATUS_LABELS, PRIORITAS_LABELS, JENIS_GANGGUAN_LABELS } from "@/lib/constants";
import { StatusAduan, Prioritas, JenisGangguan } from "@prisma/client";

interface TableRowItem {
  id: string;
  waktuMasukText: string;
  waktuResponsText: string;
  waktuSelesaiText: string;
  cabangId: string;
  cabangNama: string;
  cabangKode: string;
  wilayah: string;
  desa: string;
  noPelanggan: string;
  namaPelanggan: string;
  noHp: string;
  jenisGangguan: JenisGangguan;
  prioritas: Prioritas;
  status: StatusAduan;
  sumberAduan: string;
  unit: string;
  keterangan: string;
  catatan: string;
  lokasiDetail?: string | null;
  alasanFokus?: string;
  sla: {
    statusCode: string;
    statusLabel: string;
    statusClass: string;
    selisihText: string;
    durasiText: string;
    lamaPengerjaanText: string;
    remainingHours: number;
    lateHours: number;
  };
  fotoSelesaiUrl?: string | null;
}

interface TablesSectionProps {
  tables: {
    fokus: TableRowItem[];
    terbaru: TableRowItem[];
    selesai: TableRowItem[];
  };
  canSeeAll: boolean;
  selesaiPeriod: string;
  setSelesaiPeriod: (p: string) => void;
  onOpenAksi: (aduan: TableRowItem) => void;
  onOpenAlihkan: (aduan: TableRowItem) => void;
  onOpenDetail: (aduanId: string) => void;
  externalSearchQuery?: string;
}

export default function TablesSection({
  tables,
  canSeeAll,
  selesaiPeriod,
  setSelesaiPeriod,
  onOpenAksi,
  onOpenAlihkan,
  onOpenDetail,
  externalSearchQuery = "",
}: TablesSectionProps) {
  const [activeTab, setActiveTab] = useState<"fokus" | "terbaru" | "selesai">("fokus");
  const [searchQuery, setSearchQuery] = useState("");
  const [fokusPage, setFokusPage] = useState(1);
  const [terbaruPage, setTerbaruPage] = useState(1);
  const [selesaiPage, setSelesaiPage] = useState(1);
  const PAGE_SIZE = 8;

  const effectiveSearch = (externalSearchQuery || searchQuery).trim().toLowerCase();

  const filterRows = (rows: TableRowItem[]) => {
    if (!effectiveSearch) return rows;
    const q = effectiveSearch;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.namaPelanggan.toLowerCase().includes(q) ||
        r.noPelanggan.toLowerCase().includes(q) ||
        r.noHp.toLowerCase().includes(q) ||
        r.cabangNama.toLowerCase().includes(q) ||
        r.wilayah.toLowerCase().includes(q) ||
        (r.keterangan && r.keterangan.toLowerCase().includes(q)) ||
        (r.lokasiDetail && r.lokasiDetail.toLowerCase().includes(q))
    );
  };

  const filteredFokus = filterRows(tables.fokus);
  const filteredTerbaru = filterRows(tables.terbaru);
  const filteredSelesai = filterRows(tables.selesai);

  const paginate = (rows: TableRowItem[], page: number) => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  };

  const getPriorityBadge = (p: Prioritas) => {
    switch (p) {
      case Prioritas.DARURAT:
        return "bg-rose-500/8 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/15";
      case Prioritas.TINGGI:
        return "bg-amber-500/8 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/15";
      case Prioritas.SEDANG:
        return "bg-sky-500/8 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/15";
      default:
        return "bg-neutral-500/8 text-neutral-600 dark:text-neutral-400 ring-1 ring-neutral-500/15";
    }
  };

  const getStatusBadge = (s: StatusAduan) => {
    switch (s) {
      case StatusAduan.BARU:
        return "bg-neutral-500/8 text-neutral-600 dark:text-neutral-400 ring-1 ring-neutral-500/15";
      case StatusAduan.DIRESPONS:
        return "bg-sky-500/8 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/15";
      case StatusAduan.PROSES:
      case StatusAduan.DALAM_PENGERJAAN:
        return "bg-amber-500/8 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/15";
      case StatusAduan.KENDALA:
        return "bg-rose-500/8 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/15";
      case StatusAduan.SELESAI:
        return "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/15";
      default:
        return "bg-purple-500/8 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/15";
    }
  };

  const renderTableBody = (
    rows: TableRowItem[],
    isFokus: boolean = false,
    isSelesai: boolean = false
  ) => {
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={9} className="py-16 text-center text-sm text-neutral-400 dark:text-neutral-600">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-3">
              <CheckCircle2 className="h-5 w-5 text-neutral-400 dark:text-neutral-600" />
            </div>
            Tidak ada tiket pada kategori ini
          </td>
        </tr>
      );
    }

    return rows.map((item) => (
      <tr
        key={item.id}
        className="group transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30"
      >
        {/* ID Tiket & Waktu */}
        <td className="py-3.5 pl-5">
          <div className="font-mono text-xs font-bold text-neutral-900 dark:text-white">
            {item.id}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-600 mt-0.5">
            {item.waktuMasukText}
          </div>
        </td>

        {/* Pelanggan */}
        <td className="py-3.5 px-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 font-mono text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
              {item.namaPelanggan.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-sm text-neutral-900 dark:text-white truncate max-w-[140px]" title={item.namaPelanggan}>
                {item.namaPelanggan}
              </div>
              <div className="font-mono text-[11px] text-neutral-400 dark:text-neutral-600">
                #{item.noPelanggan}
              </div>
            </div>
          </div>
        </td>

        {/* Cabang & Wilayah */}
        <td className="py-3.5 px-3">
          <div className="font-medium text-sm text-neutral-800 dark:text-neutral-200">
            {item.cabangNama}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-600 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[110px]" title={item.wilayah}>{item.wilayah}</span>
          </div>
        </td>

        {/* Jenis Gangguan & Prioritas */}
        <td className="py-3.5 px-3">
          <div className="font-medium text-sm text-neutral-900 dark:text-white truncate max-w-[150px]" title={JENIS_GANGGUAN_LABELS[item.jenisGangguan] || item.jenisGangguan}>
            {JENIS_GANGGUAN_LABELS[item.jenisGangguan] || item.jenisGangguan}
          </div>
          <div className="mt-1">
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${getPriorityBadge(item.prioritas)}`}
            >
              {PRIORITAS_LABELS[item.prioritas] || item.prioritas}
            </span>
          </div>
        </td>

        {/* Detail Keluhan */}
        <td className="py-3.5 px-3 max-w-[220px]">
          <div className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2 leading-relaxed" title={item.keterangan || "-"}>
            {item.keterangan || <span className="text-neutral-400 italic">Tidak ada catatan</span>}
          </div>
          {item.lokasiDetail && (
            <div className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-600 truncate flex items-center gap-1" title={item.lokasiDetail}>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.lokasiDetail}</span>
            </div>
          )}
        </td>

        {/* SLA */}
        <td className="py-3.5 px-3">
          {isSelesai ? (
            <div className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
              {item.sla.durasiText || item.waktuSelesaiText}
            </div>
          ) : (
            <div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  item.sla.statusCode === "ACTIVE_LATE"
                    ? "bg-rose-500/8 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/15"
                    : item.sla.statusCode === "ACTIVE_NEAR"
                    ? "bg-amber-500/8 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/15"
                    : "bg-sky-500/8 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/15"
                }`}
              >
                <Clock className="h-2.5 w-2.5" />
                <span>{item.sla.statusLabel}</span>
              </span>
              <div className="mt-0.5 font-mono text-[10px] text-neutral-400 dark:text-neutral-600">
                {item.sla.selisihText}
              </div>
            </div>
          )}
        </td>

        {/* Status */}
        <td className="py-3.5 px-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${getStatusBadge(item.status)}`}
          >
            {STATUS_LABELS[item.status] || item.status}
          </span>
        </td>

        {/* Actions */}
        <td className="py-3.5 pr-5 text-right">
          <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onOpenDetail(item.id)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200/60 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:border-neutral-700/40 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-white transition"
              title="Lihat Detail"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {!isSelesai && (
              <button
                type="button"
                onClick={() => onOpenAksi(item)}
                className="flex h-7 items-center gap-1 rounded-lg bg-neutral-900 dark:bg-white px-2.5 text-[11px] font-medium text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-200 transition shadow-sm"
                title="Update Status"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Aksi</span>
              </button>
            )}

            {canSeeAll && !isSelesai && (
              <button
                type="button"
                onClick={() => onOpenAlihkan(item)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200/60 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:border-neutral-700/40 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-white transition"
                title="Alihkan Cabang"
              >
                <ArrowRightLeft className="h-3 w-3" />
              </button>
            )}
          </div>
        </td>
      </tr>
    ));
  };

  const currentTotal =
    activeTab === "fokus"
      ? filteredFokus.length
      : activeTab === "terbaru"
      ? filteredTerbaru.length
      : filteredSelesai.length;

  const currentPage =
    activeTab === "fokus"
      ? fokusPage
      : activeTab === "terbaru"
      ? terbaruPage
      : selesaiPage;

  const setCurrentPage = (p: number) => {
    if (activeTab === "fokus") setFokusPage(p);
    else if (activeTab === "terbaru") setTerbaruPage(p);
    else setSelesaiPage(p);
  };

  const totalPages = Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));

  const tabs = [
    {
      key: "fokus" as const,
      label: "Fokus Penanganan",
      count: tables.fokus.length,
      dotColor: "bg-rose-500",
      countColor: "text-rose-600 dark:text-rose-400 bg-rose-500/8",
      hasPulse: true,
    },
    {
      key: "terbaru" as const,
      label: "Aduan Terbaru",
      count: tables.terbaru.length,
      dotColor: "bg-sky-500",
      countColor: "text-sky-600 dark:text-sky-400 bg-sky-500/8",
      hasPulse: false,
    },
    {
      key: "selesai" as const,
      label: "Aduan Selesai",
      count: tables.selesai.length,
      dotColor: "bg-emerald-500",
      countColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/8",
      hasPulse: false,
    },
  ];

  return (
    <section className="space-y-3">
      {/* Tab Bar & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 saas-card p-3">
        {/* Tabs */}
        <div className="inline-flex rounded-xl bg-neutral-100/80 dark:bg-neutral-800/50 p-1 text-xs font-medium">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${
                activeTab === tab.key
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white font-semibold"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {tab.hasPulse && (
                <span className={`h-1.5 w-1.5 rounded-full ${tab.dotColor} animate-pulse`} />
              )}
              <span>{tab.label}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold ${tab.countColor}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari tiket, pelanggan, wilayah..."
            className="input-premium w-full rounded-xl border border-neutral-200/60 bg-neutral-50/50 pl-10 pr-3 py-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-700/40 dark:bg-neutral-800/30 dark:text-neutral-200 dark:placeholder:text-neutral-500 dark:focus:border-blue-500"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden saas-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
                <th className="py-3 pl-5 font-semibold">ID Tiket</th>
                <th className="py-3 px-3 font-semibold">Pelanggan</th>
                <th className="py-3 px-3 font-semibold">Cabang & Wilayah</th>
                <th className="py-3 px-3 font-semibold">Gangguan & Prioritas</th>
                <th className="py-3 px-3 font-semibold">Detail Keluhan</th>
                <th className="py-3 px-3 font-semibold">Target SLA</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 pr-5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
              {activeTab === "fokus" &&
                renderTableBody(paginate(filteredFokus, fokusPage), true)}
              {activeTab === "terbaru" &&
                renderTableBody(paginate(filteredTerbaru, terbaruPage), false)}
              {activeTab === "selesai" &&
                renderTableBody(paginate(filteredSelesai, selesaiPage), false, true)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-neutral-100/80 dark:border-neutral-800/50 px-5 py-3 text-xs">
          <div className="text-neutral-500 dark:text-neutral-500">
            Menampilkan{" "}
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {currentTotal > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}
            </span>
            {" - "}
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {Math.min(currentPage * PAGE_SIZE, currentTotal)}
            </span>
            {" dari "}
            <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
              {currentTotal}
            </span>
            {" aduan"}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="flex items-center gap-1 rounded-lg border border-neutral-200/60 dark:border-neutral-700/40 px-2.5 py-1.5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>

            <span className="font-mono px-2.5 text-neutral-500 dark:text-neutral-500">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="flex items-center gap-1 rounded-lg border border-neutral-200/60 dark:border-neutral-700/40 px-2.5 py-1.5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
