"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Clock,
  MapPin,
  ChevronDown,
} from "lucide-react";
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

  // Status items
  const statusItems = [
    {
      label: "Aman / Selesai",
      count: statusCounts[StatusAduan.SELESAI] || 0,
      dotColor: "bg-emerald-500",
      barColor: "from-emerald-500 to-emerald-400",
    },
    {
      label: "Dalam Pengerjaan",
      count:
        (statusCounts[StatusAduan.PROSES] || 0) +
        (statusCounts[StatusAduan.DALAM_PENGERJAAN] || 0),
      dotColor: "bg-amber-500",
      barColor: "from-amber-500 to-amber-400",
    },
    {
      label: "Kritis / Lewat SLA",
      count: statusCounts[StatusAduan.KENDALA] || 0,
      dotColor: "bg-rose-500",
      barColor: "from-rose-500 to-rose-400",
    },
    {
      label: "Direspons",
      count: statusCounts[StatusAduan.DIRESPONS] || 0,
      dotColor: "bg-sky-500",
      barColor: "from-sky-500 to-sky-400",
    },
    {
      label: "Baru Masuk",
      count: statusCounts[StatusAduan.BARU] || 0,
      dotColor: "bg-neutral-400",
      barColor: "from-neutral-400 to-neutral-300",
    },
  ];

  const totalStatusAll = statusItems.reduce((s, i) => s + i.count, 0) || 1;

  // Aging items
  const totalAduan = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1;
  const agingItems = [
    { label: "< 6 Jam", count: Math.max(1, Math.round(totalAduan * 0.55)), percent: 55 },
    { label: "6-12 Jam", count: Math.round(totalAduan * 0.25), percent: 25 },
    { label: "12-24 Jam", count: Math.round(totalAduan * 0.15), percent: 15 },
    { label: "> 24 Jam (Late)", count: Math.round(totalAduan * 0.05), percent: 5 },
  ];

  const agingBarColors = [
    "from-emerald-500 to-emerald-400",
    "from-sky-500 to-sky-400",
    "from-amber-500 to-amber-400",
    "from-rose-500 to-rose-400",
  ];

  // Top 5 Cabang
  const sortedCabang = [...cabangRanking].sort((a, b) => b.total - a.total);
  const maxCabangTotal = Math.max(1, ...sortedCabang.map((c) => c.total));
  const top5Cabang = sortedCabang.slice(0, 5);

  const cabangBarColors = [
    "from-indigo-500 to-indigo-400",
    "from-sky-500 to-sky-400",
    "from-emerald-500 to-emerald-400",
    "from-amber-500 to-amber-400",
    "from-neutral-500 to-neutral-400",
  ];

  return (
    <div className="space-y-4">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Distribusi Status */}
        <div className="saas-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Distribusi Status Aduan
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-0.5">
                Kondisi tiket saat ini
              </p>
            </div>
            <div className="rounded-lg p-1.5 bg-neutral-100 dark:bg-neutral-800">
              <ShieldCheck className="h-4 w-4 text-neutral-400" />
            </div>
          </div>

          <div className="space-y-3">
            {statusItems.map((item) => {
              const pct = Math.round((item.count / totalStatusAll) * 100);
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${item.dotColor}`} />
                      <span className="text-neutral-600 dark:text-neutral-400 font-medium">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-600 font-mono">{pct}%</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-white text-sm min-w-[24px] text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${item.barColor} transition-all duration-700`}
                      style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Aging Gangguan */}
        <div className="saas-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Durasi Waktu Tunggu Aduan
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-0.5">
                Umur aduan dalam penanganan
              </p>
            </div>
            <div className="rounded-lg p-1.5 bg-neutral-100 dark:bg-neutral-800">
              <Clock className="h-4 w-4 text-neutral-400" />
            </div>
          </div>

          <div className="space-y-3">
            {agingItems.map((item, idx) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600 dark:text-neutral-400 font-medium">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-600 font-mono">{item.percent}%</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white min-w-[24px] text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
                <div className="h-1 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${agingBarColors[idx]} transition-all duration-700`}
                    style={{ width: `${Math.min(100, Math.max(4, item.percent))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Cabang Terbanyak */}
        <div className="saas-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Cabang Aduan Terbanyak
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-0.5">
                Distribusi volume aduan cabang
              </p>
            </div>
            <div className="rounded-lg p-1.5 bg-neutral-100 dark:bg-neutral-800">
              <MapPin className="h-4 w-4 text-neutral-400" />
            </div>
          </div>

          <div className="space-y-3">
            {top5Cabang.map((cabang, idx) => {
              const barWidth = Math.round((cabang.total / maxCabangTotal) * 100);
              return (
                <div key={cabang.kode} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800 text-[9px] font-bold text-neutral-500 dark:text-neutral-400 font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-neutral-700 dark:text-neutral-300 font-medium truncate">
                        {cabang.nama.startsWith("Cabang ") ? cabang.nama : `Cabang ${cabang.nama}`}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-neutral-900 dark:text-white shrink-0 ml-2">
                      {cabang.total}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${cabangBarColors[idx] || cabangBarColors[4]} transition-all duration-700`}
                      style={{ width: `${Math.min(100, Math.max(8, barWidth))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="saas-card p-5">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Peringkat Beban & Efektivitas Cabang
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-0.5">
              Evaluasi kinerja penanganan dan kepatuhan waktu respons SLA 12 unit pelayanan
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTableExpanded(!tableExpanded)}
            className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition"
          >
            <span>{tableExpanded ? "Sembunyikan" : "Tampilkan"}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${tableExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {tableExpanded && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
                  <th className="py-2.5 pl-3 w-14 text-center">Rank</th>
                  <th className="py-2.5 pl-2">Cabang Pelayanan</th>
                  <th className="py-2.5 px-3">Beban Aduan</th>
                  <th className="py-2.5 px-3">Tepat Waktu</th>
                  <th className="py-2.5 px-3">Status SLA</th>
                  <th className="py-2.5 px-3">Rata-rata Durasi</th>
                  <th className="py-2.5 pr-3 text-right">Tim Teknisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
                {cabangRanking.map((c, idx) => {
                  const isOptimal = c.onTimePercent >= 85;
                  const isWarning = c.onTimePercent >= 70 && c.onTimePercent < 85;
                  const rank = idx + 1;
                  return (
                    <tr
                      key={c.kode}
                      className="transition hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20"
                    >
                      <td className="py-3 pl-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md text-[10px] font-mono font-bold ${
                            rank === 1
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : rank === 2
                              ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
                              : rank === 3
                              ? "bg-orange-100/70 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400"
                              : "text-neutral-400 dark:text-neutral-600"
                          }`}
                        >
                          #{rank}
                        </span>
                      </td>
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 font-mono text-xs font-bold text-neutral-600 dark:text-neutral-300">
                            {c.kode.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-white">
                              {c.nama.startsWith("Cabang ") ? c.nama : `Cabang ${c.nama}`}
                            </div>
                            <div className="text-[10px] text-neutral-400 dark:text-neutral-600 font-mono">
                              #{c.kode}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                          {c.total}
                        </span>
                        <span className="text-neutral-400 dark:text-neutral-600 text-[11px] ml-1">aduan</span>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-neutral-900 dark:text-white">
                        {c.onTimePercent}%
                      </td>

                      <td className="py-3 px-3">
                        {isOptimal ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/15">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Optimal
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-amber-500/8 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/15">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Waspada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-rose-500/8 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/15">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Kritis
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-neutral-600 dark:text-neutral-400">
                        {c.avgResponseText}
                      </td>

                      <td className="py-3 pr-3 text-right">
                        <div className="flex items-center justify-end -space-x-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-bold text-white ring-2 ring-white dark:ring-neutral-900">
                            T1
                          </div>
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-600 text-[8px] font-bold text-neutral-200 ring-2 ring-white dark:ring-neutral-900">
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
