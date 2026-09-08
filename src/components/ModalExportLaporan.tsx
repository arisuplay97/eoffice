"use client";

import React, { useState } from "react";
import { X, Download, Printer, FileSpreadsheet, QrCode } from "lucide-react";
import * as XLSX from "xlsx";

interface ModalExportLaporanProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function ModalExportLaporan({
  isOpen,
  onClose,
  user,
}: ModalExportLaporanProps) {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("this_month");
  const [reportData, setReportData] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/export?period=${period}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Gagal memuat laporan.");
      setReportData(data);
    } catch (e: any) {
      alert(e.message || "Gagal memuat data laporan.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!reportData || !reportData.rows) return;

    // Build worksheet data
    const ws = XLSX.utils.json_to_sheet(reportData.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Aduan");

    const fileName = `Laporan_Gangguan_${reportData.meta.reportCode}_${period}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Export Laporan Bulanan Gangguan Air</h2>
            <p className="text-xs text-slate-500">
              Format resmi Excel dan cetak PDF dengan autentikasi QR Code
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <label className="mb-1 block font-semibold text-slate-700">Pilih Periode Laporan</label>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setReportData(null);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-600 focus:outline-none"
              >
                <option value="today">Hari Ini</option>
                <option value="this_month">Bulan Ini</option>
                <option value="last_month">Bulan Sebelumnya</option>
                <option value="all">Semua Periode</option>
              </select>
            </div>
            <div className="self-end">
              <button
                type="button"
                onClick={handleFetchReport}
                disabled={loading}
                className="rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {loading ? "Menyiapkan..." : "Muat Data Laporan"}
              </button>
            </div>
          </div>

          {reportData && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              {/* Summary Strip (PRD V11.10.4) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Ringkasan Kinerja Periode {reportData.meta.periodLabel}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-slate-500 block">Total Aduan</span>
                    <strong className="text-lg font-mono text-slate-900">
                      {reportData.stats.totalAduan}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Aduan Selesai</span>
                    <strong className="text-lg font-mono text-emerald-700">
                      {reportData.stats.totalSelesai}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Telat Respons</span>
                    <strong className="text-lg font-mono text-rose-600">
                      {reportData.stats.totalTelatRespon}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Persen Selesai</span>
                    <strong className="text-lg font-mono text-sky-800">
                      {reportData.stats.persenSelesai}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* QR Code Verification Preview */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reportData.meta.qrDataUrl}
                    alt="QR Verification"
                    className="h-16 w-16 rounded border border-slate-200"
                  />
                  <div>
                    <div className="font-bold text-slate-900">{reportData.meta.reportCode}</div>
                    <div className="text-[11px] text-slate-500">
                      Diterbitkan oleh: {reportData.meta.generatedBy}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Waktu Cetak: {reportData.meta.generatedAt} WITA
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Download Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 shadow-sm"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Cetak PDF</span>
                  </button>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>ID</th>
                      <th>Waktu Masuk</th>
                      <th>Cabang</th>
                      <th>Pelanggan</th>
                      <th>Gangguan</th>
                      <th>Status</th>
                      <th>Durasi Respons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.slice(0, 10).map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.no}</td>
                        <td className="font-mono font-bold text-sky-800">{r.id}</td>
                        <td>{r.waktuMasuk}</td>
                        <td>{r.cabang}</td>
                        <td>{r.namaPelanggan}</td>
                        <td>{r.jenisGangguan}</td>
                        <td>{r.status}</td>
                        <td>{r.durasiRespons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reportData.rows.length > 10 && (
                <p className="text-[11px] text-slate-400 text-center">
                  Menampilkan 10 dari {reportData.rows.length} baris. Seluruh data akan diunduh pada
                  file Excel atau dicetak pada PDF.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 mt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
