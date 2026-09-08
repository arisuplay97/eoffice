"use client";

import React, { useState } from "react";
import {
  Clock,
  ArrowRightLeft,
  Eye,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  MapPin,
  Flame,
  ShieldCheck,
  AlertTriangle,
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
        return "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
      case Prioritas.TINGGI:
        return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case Prioritas.SEDANG:
        return "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400";
      default:
        return "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400";
    }
  };

  const getStatusBadge = (s: StatusAduan) => {
    switch (s) {
      case StatusAduan.BARU:
        return "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400";
      case StatusAduan.DIRESPONS:
        return "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400";
      case StatusAduan.PROSES:
      case StatusAduan.DALAM_PENGERJAAN:
        return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case StatusAduan.KENDALA:
        return "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
      case StatusAduan.SELESAI:
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      default:
        return "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400";
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
          <td colSpan={9} className="py-12 text-center text-xs text-slate-400 dark:text-dark-muted">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-dark-elevated mb-2">
              <CheckCircle2 className="h-5 w-5 text-slate-400" />
            </div>
            Tidak ada tiket pada kategori ini
          </td>
        </tr>
      );
    }

    return rows.map((item) => (
      <tr
        key={item.id}
        className="transition hover:bg-slate-50/80 dark:hover:bg-dark-elevated/40"
      >
        {/* ID Tiket & Waktu Masuk */}
        <td className="py-3 pl-4">
          <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
            {item.id}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-dark-muted">
            {item.waktuMasukText}
          </div>
        </td>

        {/* Pelanggan & No Sambungan */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-dark-elevated font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200">
              {item.namaPelanggan.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px]" title={item.namaPelanggan}>
                {item.namaPelanggan}
              </div>
              <div className="font-mono text-[11px] text-slate-400 dark:text-dark-muted">
                #{item.noPelanggan}
              </div>
            </div>
          </div>
        </td>

        {/* Cabang & Wilayah */}
        <td className="py-3 px-3">
          <div className="font-medium text-slate-800 dark:text-slate-200">
            {item.cabangNama}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-dark-muted flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[110px]" title={item.wilayah}>{item.wilayah}</span>
          </div>
        </td>

        {/* Jenis Gangguan & Prioritas */}
        <td className="py-3 px-3">
          <div className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]" title={JENIS_GANGGUAN_LABELS[item.jenisGangguan] || item.jenisGangguan}>
            {JENIS_GANGGUAN_LABELS[item.jenisGangguan] || item.jenisGangguan}
          </div>
          <div className="mt-0.5">
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${getPriorityBadge(
                item.prioritas
              )}`}
            >
              {PRIORITAS_LABELS[item.prioritas] || item.prioritas}
            </span>
          </div>
        </td>

        {/* Detail Keluhan Pelanggan */}
        <td className="py-3 px-3 max-w-[220px]">
          <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed" title={item.keterangan || "-"}>
            {item.keterangan || <span className="text-slate-400 italic font-normal">Tidak ada catatan</span>}
          </div>
          {item.lokasiDetail && (
            <div className="mt-1 text-[11px] text-slate-400 dark:text-dark-muted truncate flex items-center gap-1" title={item.lokasiDetail}>
              <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{item.lokasiDetail}</span>
            </div>
          )}
        </td>

        {/* SLA Status / Countdown */}
        <td className="py-3 px-3">
          {isSelesai ? (
            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
              {item.sla.durasiText || item.waktuSelesaiText}
            </div>
          ) : (
            <div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                  item.sla.statusCode === "ACTIVE_LATE"
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : item.sla.statusCode === "ACTIVE_NEAR"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                }`}
              >
                <Clock className="h-2.5 w-2.5" />
                <span>{item.sla.statusLabel}</span>
              </span>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-dark-muted">
                {item.sla.selisihText}
              </div>
            </div>
          )}
        </td>

        {/* Status Aduan Pill */}
        <td className="py-3 px-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${getStatusBadge(
              item.status
            )}`}
          >
            {STATUS_LABELS[item.status] || item.status}
          </span>
        </td>

        {/* Action Buttons */}
        <td className="py-3 pr-4 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onOpenDetail(item.id)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-dark-border dark:text-slate-400 dark:hover:bg-dark-hover dark:hover:text-white transition"
              title="Lihat Detail Aduan"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {!isSelesai && (
              <button
                type="button"
                onClick={() => onOpenAksi(item)}
                className="flex h-7 items-center gap-1 rounded-lg bg-sky-600 px-2 text-[11px] font-medium text-white hover:bg-sky-500 transition shadow-sm"
                title="Update Status & Dokumentasi"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Aksi</span>
              </button>
            )}

            {canSeeAll && !isSelesai && (
              <button
                type="button"
                onClick={() => onOpenAlihkan(item)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-dark-border dark:text-slate-400 dark:hover:bg-dark-hover dark:hover:text-white transition"
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

  return (
    <section className="space-y-4">
      {/* Universal Search & Category Tabs Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-dark-border dark:bg-dark-card">
        {/* Modern Tab Selector */}
        <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-50 p-1 text-xs font-semibold dark:border-dark-border dark:bg-dark-elevated">
          <button
            type="button"
            onClick={() => setActiveTab("fokus")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === "fokus"
                ? "bg-white text-slate-900 shadow-sm dark:bg-dark-card dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Fokus Penanganan</span>
            <span className="rounded-full bg-rose-500/10 px-1.5 py-0.2 text-[10px] text-rose-600 dark:text-rose-400 font-mono">
              {tables.fokus.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("terbaru")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === "terbaru"
                ? "bg-white text-slate-900 shadow-sm dark:bg-dark-card dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <span>Aduan Terbaru</span>
            <span className="rounded-full bg-sky-500/10 px-1.5 py-0.2 text-[10px] text-sky-600 dark:text-sky-400 font-mono">
              {tables.terbaru.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("selesai")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === "selesai"
                ? "bg-white text-slate-900 shadow-sm dark:bg-dark-card dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <span>Aduan Selesai</span>
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
              {tables.selesai.length}
            </span>
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari ID tiket, pelanggan, no hp, wilayah..."
            className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 transition focus:border-sky-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-elevated/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-dark-card"
          />
        </div>
      </div>

      {/* High-Density Data Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-dark-border dark:bg-dark-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-dark-border dark:bg-dark-elevated/30 dark:text-dark-muted">
                <th className="py-3 pl-4">ID Tiket</th>
                <th className="py-3 px-3">Pelanggan</th>
                <th className="py-3 px-3">Cabang & Wilayah</th>
                <th className="py-3 px-3">Gangguan & Prioritas</th>
                <th className="py-3 px-3">Detail Keluhan</th>
                <th className="py-3 px-3">Target SLA</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
              {activeTab === "fokus" &&
                renderTableBody(paginate(filteredFokus, fokusPage), true)}
              {activeTab === "terbaru" &&
                renderTableBody(paginate(filteredTerbaru, terbaruPage), false)}
              {activeTab === "selesai" &&
                renderTableBody(paginate(filteredSelesai, selesaiPage), false, true)}
            </tbody>
          </table>
        </div>

        {/* Clean SaaS Pagination Bar (Reference Image 2) */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs dark:border-dark-border">
          <div className="text-slate-500 dark:text-dark-muted">
            Menampilkan{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {currentTotal > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}
            </span>{" "}
            -{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {Math.min(currentPage * PAGE_SIZE, currentTotal)}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
              {currentTotal}
            </span>{" "}
            aduan
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-dark-border dark:text-slate-300 dark:hover:bg-dark-hover"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Sebelumnya</span>
            </button>

            <span className="font-mono px-2 text-slate-600 dark:text-slate-400">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-dark-border dark:text-slate-300 dark:hover:bg-dark-hover"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
