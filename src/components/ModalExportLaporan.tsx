"use client";

import React, { useState } from "react";
import { X, Download, Printer } from "lucide-react";
import XLSX from "xlsx-js-style";
import { CABANG_LIST } from "@/lib/constants";

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
  const [period, setPeriod] = useState("last_month");
  const [cabangId, setCabangId] = useState(
    user?.canSeeAll ? "Semua" : (user?.cabangNama ? user.cabangNama.replace(/^Cabang\s*/i, "") : "Semua")
  );
  const [reportData, setReportData] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/export?period=${period}&cabangId=${encodeURIComponent(cabangId)}`
      );
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

    const meta = reportData.meta;
    const stats = reportData.stats;
    const rows = reportData.rows;

    // 1. Build Array of Arrays (AOA) matching exact user format
    const aoa: any[][] = [
      ["Laporan Gangguan Per Cabang"],
      ["SIAGA TIARA - PERUMDAM Tirta Ardhia Rinjani"],
      [`Periode: ${meta.periodLabel || "Semua Periode"}`],
      [`Cabang : ${meta.cabangLabel || "Semua Cabang"}`],
      [`Tanggal Cetak: ${meta.tanggalCetak || meta.generatedAt}`],
      [], // Row 6 blank
      ["Detail Aduan Gangguan"],
      [
        `Jumlah Aduan : ${stats.totalAduan}    Selesai : ${stats.totalSelesai}    Telat Respon : ${stats.totalTelatRespon}`,
      ],
      [], // Row 9 blank
      [
        "No",
        "ID",
        "Waktu",
        "Cabang",
        "Pelanggan",
        "No HP",
        "Jenis",
        "Sumber Aduan",
        "No Pelanggan",
        "Status",
        "Petugas",
        "SLA",
        "Keterangan",
      ],
    ];

    // Data rows (Row 11+)
    rows.forEach((r: any) => {
      aoa.push([
        r.no,
        r.id,
        r.waktu,
        r.cabang,
        r.pelanggan,
        String(r.noHp || "-"),
        r.jenis,
        r.sumberAduan,
        String(r.noPelanggan || "-"),
        r.status,
        r.petugas,
        r.sla,
        r.keterangan,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 2. Styling Cells matching the template
    // Title Row 1 (A1)
    if (ws["A1"]) {
      ws["A1"].s = {
        font: { name: "Calibri", sz: 14, bold: true, color: { rgb: "000000" } },
        alignment: { vertical: "center" },
      };
    }

    // Metadata Rows 2 to 5 (A2, A3, A4, A5)
    ["A2", "A3", "A4", "A5"].forEach((ref) => {
      if (ws[ref]) {
        ws[ref].s = {
          font: { name: "Calibri", sz: 10, color: { rgb: "000000" } },
          alignment: { vertical: "center" },
        };
      }
    });

    // Subtitle Row 7 (A7)
    if (ws["A7"]) {
      ws["A7"].s = {
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "000000" } },
        alignment: { vertical: "center" },
      };
    }

    // Stats Row 8 (A8)
    if (ws["A8"]) {
      ws["A8"].s = {
        font: { name: "Calibri", sz: 10, color: { rgb: "000000" } },
        alignment: { vertical: "center" },
      };
    }

    // Table Header Row 10: Dark Navy Blue Background, White Bold Text, Centered
    const headerCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
    headerCols.forEach((col) => {
      const cellRef = `${col}10`;
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "0F2744" } }, // Dark navy header
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "334155" } },
            bottom: { style: "thin", color: { rgb: "334155" } },
            left: { style: "thin", color: { rgb: "334155" } },
            right: { style: "thin", color: { rgb: "334155" } },
          },
        };
      }
    });

    // Data Rows Border & Alignment
    const thinBorder = {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } },
    };

    rows.forEach((_: any, idx: number) => {
      const rowNum = 11 + idx;

      // Col A (No)
      const refA = `A${rowNum}`;
      if (ws[refA]) {
        ws[refA].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
      }

      // Col B (ID)
      const refB = `B${rowNum}`;
      if (ws[refB]) {
        ws[refB].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
      }

      // Col C (Waktu)
      const refC = `C${rowNum}`;
      if (ws[refC]) {
        ws[refC].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
      }

      // Col D (Cabang)
      const refD = `D${rowNum}`;
      if (ws[refD]) {
        ws[refD].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
      }

      // Col E (Pelanggan)
      const refE = `E${rowNum}`;
      if (ws[refE]) {
        ws[refE].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
      }

      // Col F (No HP) - Force String type
      const refF = `F${rowNum}`;
      if (ws[refF]) {
        ws[refF].t = "s";
        ws[refF].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
      }

      // Col G (Jenis)
      const refG = `G${rowNum}`;
      if (ws[refG]) {
        ws[refG].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
      }

      // Col H (Sumber Aduan)
      const refH = `H${rowNum}`;
      if (ws[refH]) {
        ws[refH].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
      }

      // Col I (No Pelanggan) - Force String type
      const refI = `I${rowNum}`;
      if (ws[refI]) {
        ws[refI].t = "s";
        ws[refI].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
      }

      // Col J (Status)
      const refJ = `J${rowNum}`;
      if (ws[refJ]) {
        ws[refJ].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
      }

      // Col K (Petugas)
      const refK = `K${rowNum}`;
      if (ws[refK]) {
        ws[refK].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
      }

      // Col L (SLA)
      const refL = `L${rowNum}`;
      if (ws[refL]) {
        ws[refL].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
      }

      // Col M (Keterangan)
      const refM = `M${rowNum}`;
      if (ws[refM]) {
        ws[refM].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
      }
    });

    // Column widths
    ws["!cols"] = [
      { wch: 6 },   // No
      { wch: 13 },  // ID
      { wch: 18 },  // Waktu
      { wch: 18 },  // Cabang
      { wch: 25 },  // Pelanggan
      { wch: 16 },  // No HP
      { wch: 18 },  // Jenis
      { wch: 16 },  // Sumber Aduan
      { wch: 16 },  // No Pelanggan
      { wch: 14 },  // Status
      { wch: 22 },  // Petugas
      { wch: 14 },  // SLA
      { wch: 45 },  // Keterangan
    ];

    // Enable AutoFilter dropdown arrows on Row 10
    ws["!autofilter"] = { ref: `A10:M${10 + rows.length}` };

    // Row heights
    ws["!rows"] = [
      { hpt: 24 }, // Row 1
      { hpt: 18 }, // Row 2
      { hpt: 18 }, // Row 3
      { hpt: 18 }, // Row 4
      { hpt: 18 }, // Row 5
      { hpt: 8 },  // Row 6
      { hpt: 20 }, // Row 7
      { hpt: 18 }, // Row 8
      { hpt: 8 },  // Row 9
      { hpt: 24 }, // Row 10
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Gangguan");

    const cleanCabangFile = (meta.cabangLabel || "Semua").replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `Laporan_Gangguan_${cleanCabangFile}_${period}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Export Laporan Gangguan Per Cabang</h2>
            <p className="text-xs text-slate-500">
              Format standar resmi Excel (.xlsx) dengan tabel berfilter dan cetak PDF QR Code
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Pilih Periode Laporan</label>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setReportData(null);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-600 focus:outline-none"
              >
                <option value="last_month">Bulan Lalu (Rekomendasi)</option>
                <option value="this_month">Bulan Ini</option>
                <option value="today">Hari Ini</option>
                <option value="all">Semua Periode</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Pilih Cabang</label>
              <select
                value={cabangId}
                onChange={(e) => {
                  setCabangId(e.target.value);
                  setReportData(null);
                }}
                disabled={!user?.canSeeAll && !!user?.cabangId}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-600 focus:outline-none disabled:bg-slate-100"
              >
                {user?.canSeeAll && <option value="Semua">Semua Cabang</option>}
                {CABANG_LIST.map((c) => (
                  <option key={c.kode} value={c.nama.replace(/^Cabang\s*/i, "")}>
                    {c.nama}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                type="button"
                onClick={handleFetchReport}
                disabled={loading}
                className="w-full rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {loading ? "Menyiapkan..." : "Muat Data Laporan"}
              </button>
            </div>
          </div>

          {reportData && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              {/* Summary Strip */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Ringkasan Kinerja • {reportData.meta.periodLabel} • {reportData.meta.cabangLabel}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-slate-500 block">Jumlah Aduan</span>
                    <strong className="text-lg font-mono text-slate-900">
                      {reportData.stats.totalAduan}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Selesai</span>
                    <strong className="text-lg font-mono text-emerald-700">
                      {reportData.stats.totalSelesai}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Telat Respon</span>
                    <strong className="text-lg font-mono text-rose-600">
                      {reportData.stats.totalTelatRespon}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Persen Tuntas</span>
                    <strong className="text-lg font-mono text-sky-800">
                      {reportData.stats.persenSelesai}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reportData.meta.qrDataUrl}
                    alt="QR Verification"
                    className="h-14 w-14 rounded border border-slate-200"
                  />
                  <div>
                    <div className="font-bold text-slate-900">{reportData.meta.reportCode}</div>
                    <div className="text-[11px] text-slate-500">
                      Cabang: <span className="font-medium text-slate-800">{reportData.meta.cabangLabel}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Waktu Cetak: {reportData.meta.tanggalCetak}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 shadow-sm transition"
                  >
                    <Download className="h-4 w-4 text-emerald-600" />
                    <span>Download Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 shadow-sm transition"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Cetak PDF</span>
                  </button>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="max-h-72 overflow-x-auto overflow-y-auto border border-slate-200 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200 text-left text-[11px]">
                  <thead className="bg-[#0F2744] text-white font-semibold sticky top-0">
                    <tr>
                      <th className="px-2.5 py-2 text-center">No</th>
                      <th className="px-2.5 py-2 text-center">ID</th>
                      <th className="px-2.5 py-2 text-center">Waktu</th>
                      <th className="px-2.5 py-2">Cabang</th>
                      <th className="px-2.5 py-2">Pelanggan</th>
                      <th className="px-2.5 py-2">No HP</th>
                      <th className="px-2.5 py-2">Jenis</th>
                      <th className="px-2.5 py-2">Sumber Aduan</th>
                      <th className="px-2.5 py-2">No Pelanggan</th>
                      <th className="px-2.5 py-2 text-center">Status</th>
                      <th className="px-2.5 py-2">Petugas</th>
                      <th className="px-2.5 py-2 text-center">SLA</th>
                      <th className="px-2.5 py-2">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {reportData.rows.slice(0, 10).map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1.5 text-center font-mono text-slate-500">{r.no}</td>
                        <td className="px-2.5 py-1.5 text-center font-mono font-bold text-sky-800">{r.id}</td>
                        <td className="px-2.5 py-1.5 text-center whitespace-nowrap text-slate-600">{r.waktu}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap font-medium text-slate-800">{r.cabang}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-700">{r.pelanggan}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap font-mono text-slate-600">{r.noHp}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-700">{r.jenis}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-600">{r.sumberAduan}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap font-mono text-slate-600">{r.noPelanggan}</td>
                        <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              r.status === "Selesai"
                                ? "bg-emerald-50 text-emerald-700"
                                : r.status === "Batal"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-sky-50 text-sky-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-700">{r.petugas}</td>
                        <td className="px-2.5 py-1.5 text-center whitespace-nowrap font-medium">
                          <span
                            className={
                              r.sla === "Tepat waktu"
                                ? "text-emerald-700"
                                : r.sla === "Terlambat"
                                ? "text-rose-600 font-semibold"
                                : "text-slate-500"
                            }
                          >
                            {r.sla}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 max-w-xs truncate text-slate-600" title={r.keterangan}>
                          {r.keterangan}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reportData.rows.length > 10 && (
                <p className="text-[11px] text-slate-400 text-center">
                  Menampilkan 10 dari {reportData.rows.length} baris di preview. Seluruh data lengkap akan
                  diekspor ke file Excel (.xlsx).
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
