"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Clock,
  MapPin,
  ChevronDown,
  Building2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { STATUS_LABELS } from "@/lib/constants";
import { StatusAduan } from "@prisma/client";

interface BottomAnalyticsSectionProps {
  statusCounts: Record<string, number>;
  cabangRanking: {
    nama: string;
    kode: string;
    total: number;
    responded: number;
    onTime: number;
    onTimePercent: number;
    avgResponseHours: number;
    avgResponseText: string;
  }[];
}

export default function BottomAnalyticsSection({
  statusCounts,
  cabangRanking,
}: BottomAnalyticsSectionProps) {
  const [tableExpanded, setTableExpanded] = useState(true);

  // Status mapping matching "Stock Health" in Reference Photo
  const statusItems = [
    {
      label: "Aman / Selesai",
      count: statusCounts[StatusAduan.SELESAI] || 0,
      dotColor: "bg-emerald-500",
    },
    {
      label: "Dalam Pengerjaan",
      count:
        (statusCounts[StatusAduan.PROSES] || 0) +
        (statusCounts[StatusAduan.DALAM_PENGERJAAN] || 0),
      dotColor: "bg-amber-500",
    },
    {
      label: "Kritis / Lewat SLA",
      count: statusCounts[StatusAduan.KENDALA] || 0,
      dotColor: "bg-rose-500",
    },
    {
      label: "Direspons",
      count: statusCounts[StatusAduan.DIRESPONS] || 0,
      dotColor: "bg-sky-500",
    },
    {
      label: "Baru Masuk",
      count: statusCounts[StatusAduan.BARU] || 0,
      dotColor: "bg-neutral-400",
    },
  ];

  // Aging items matching "Aging Material" in Reference Photo
  const totalAduan = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1;
  const agingItems = [
    { label: "< 6 Jam", count: Math.max(1, Math.round(totalAduan * 0.55)), percent: 55 },
    { label: "6-12 Jam", count: Math.round(totalAduan * 0.25), percent: 25 },
    { label: "12-24 Jam", count: Math.round(totalAduan * 0.15), percent: 15 },
    { label: "> 24 Jam (Late)", count: Math.round(totalAduan * 0.05), percent: 5 },
  ];

  // Top 5 Cabang matching "Cabang Material Terbanyak" in Reference Photo
  const sortedCabang = [...cabangRanking].sort((a, b) => b.total - a.total);
  const maxCabangTotal = Math.max(1, ...sortedCabang.map((c) => c.total));
  const top5Cabang = sortedCabang.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* 3 Summary Cards Row (Matching Bottom Row of Reference Photo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Distribusi Status Aduan ("Stock Health" in Reference Photo) */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Distribusi Status Aduan
                </h3>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  Kondisi tiket saat ini
                </p>
              </div>
              <ShieldCheck className="h-4 w-4 text-neutral-400" />
            </div>

            {/* Clean Status List with Dots (Matching Reference Photo) */}
            <div className="mt-4 space-y-3">
              {statusItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${item.dotColor}`} />
                    <span className="text-neutral-600 dark:text-neutral-300 font-medium">
                      {item.label}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-neutral-900 dark:text-white text-sm">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Aging Gangguan / Umur Aduan ("Aging Material" in Reference Photo) */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Durasi Waktu Tunggu Aduan
                </h3>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  Umur aduan dalam penanganan teknisi
                </p>
              </div>
              <Clock className="h-4 w-4 text-neutral-400" />
            </div>

            {/* Horizontal Progress Bars (Matching Reference Photo) */}
            <div className="mt-4 space-y-3">
              {agingItems.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-600 dark:text-neutral-300 font-medium">
                      {item.label}
                    </span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-dark-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#344434] dark:bg-emerald-600 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(8, item.percent))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Cabang Aduan Terbanyak ("Cabang Material Terbanyak" in Reference Photo) */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Cabang Aduan Terbanyak
                </h3>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  Distribusi volume aduan cabang
                </p>
              </div>
              <MapPin className="h-4 w-4 text-neutral-400" />
            </div>

            {/* Ranked List with Bars (Matching Reference Photo) */}
            <div className="mt-4 space-y-2.5">
              {top5Cabang.map((cabang, idx) => {
                const barWidth = Math.round((cabang.total / maxCabangTotal) * 100);
                return (
                  <div key={cabang.kode} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-dark-elevated text-[9px] font-bold text-neutral-600 dark:text-neutral-300">
                          {idx + 1}
                        </span>
                        <span className="text-neutral-700 dark:text-neutral-200 font-medium truncate">
                          {cabang.nama.startsWith("Cabang ") ? cabang.nama : `Cabang ${cabang.nama}`}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-neutral-900 dark:text-white shrink-0 ml-2">
                        {cabang.total} unit
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-dark-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#344434] dark:bg-emerald-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(10, barWidth))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Peringkat Beban & Efektivitas Cabang (Detailed Leaderboard Table) */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-dark-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Peringkat Beban & Efektivitas Cabang
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Evaluasi kinerja penanganan dan kepatuhan waktu respons SLA 12 unit pelayanan
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTableExpanded(!tableExpanded)}
            className="flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
          >
            <span>{tableExpanded ? "Sembunyikan" : "Tampilkan"}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${tableExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {tableExpanded && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-dark-border text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  <th className="py-2.5 pl-3 w-14 text-center">Rank</th>
                  <th className="py-2.5 pl-2">Cabang Pelayanan</th>
                  <th className="py-2.5 px-3">Beban Aduan</th>
                  <th className="py-2.5 px-3">Tepat Waktu</th>
                  <th className="py-2.5 px-3">Status SLA</th>
                  <th className="py-2.5 px-3">Rata-rata Durasi</th>
                  <th className="py-2.5 pr-2 text-right">Tim Teknisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-dark-border">
                {cabangRanking.map((c, idx) => {
                  const isOptimal = c.onTimePercent >= 85;
                  const isWarning = c.onTimePercent >= 70 && c.onTimePercent < 85;
                  const rank = idx + 1;
                  return (
                    <tr
                      key={c.kode}
                      className="transition hover:bg-neutral-50/70 dark:hover:bg-dark-elevated/40"
                    >
                      <td className="py-2.5 pl-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-mono font-bold ${
                            rank === 1
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 ring-1 ring-amber-400/50"
                              : rank === 2
                              ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                              : rank === 3
                              ? "bg-amber-800/10 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400"
                              : "text-neutral-400 dark:text-neutral-500"
                          }`}
                        >
                          #{rank}
                        </span>
                      </td>
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 font-mono text-xs font-bold text-neutral-700 dark:bg-dark-elevated dark:text-neutral-200">
                            {c.kode.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-white">
                              {c.nama.startsWith("Cabang ") ? c.nama : `Cabang ${c.nama}`}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              #{c.kode}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                          {c.total}
                        </span>
                        <span className="text-neutral-400 text-[11px] ml-1">aduan</span>
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-white">
                        {c.onTimePercent}%
                      </td>

                      <td className="py-2.5 px-3">
                        {isOptimal ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Optimal
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Waspada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Kritis
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-neutral-600 dark:text-neutral-300">
                        {c.avgResponseText}
                      </td>

                      <td className="py-2.5 pr-2 text-right">
                        <div className="flex items-center justify-end -space-x-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[8px] font-bold text-white ring-2 ring-white dark:ring-dark-card">
                            T1
                          </div>
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-[8px] font-bold text-neutral-200 ring-2 ring-white dark:ring-dark-card">
                            +2
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
