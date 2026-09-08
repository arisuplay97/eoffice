"use client";

import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { STATUS_LABELS } from "@/lib/constants";
import { StatusAduan } from "@prisma/client";
import {
  Activity,
  TrendingUp,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface ChartsSectionProps {
  charts: {
    trend7Days: { label: string; dateKey: string; count: number }[];
    statusCounts: Record<string, number>;
    dominantDisturbances: { label: string; count: number }[];
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
  };
}

const STATUS_COLORS: Record<string, string> = {
  [StatusAduan.BARU]: "#94a3b8",
  [StatusAduan.DIRESPONS]: "#0ea5e9",
  [StatusAduan.PROSES]: "#f59e0b",
  [StatusAduan.DALAM_PENGERJAAN]: "#d97706",
  [StatusAduan.KENDALA]: "#f43f5e",
  [StatusAduan.SELESAI]: "#10b981",
  [StatusAduan.DITUNDA]: "#8b5cf6",
  [StatusAduan.BATAL]: "#cbd5e1",
};

export default function ChartsSection({ charts }: ChartsSectionProps) {
  const [periodTab, setPeriodTab] = useState<"7D" | "1M" | "ALL">("7D");

  // Transform status data for PieChart
  const pieData = Object.entries(charts.statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_LABELS[status as StatusAduan] || status,
      value: count,
      color: STATUS_COLORS[status] || "#64748b",
    }));

  const totalStatus = pieData.reduce((acc, curr) => acc + curr.value, 0);

  // Custom Tooltip for AreaChart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md dark:border-dark-border dark:bg-dark-card/95">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-dark-muted">
            {label}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
              {payload[0].value} Aduan
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="space-y-4">
      {/* Top Visualizations Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Spline Wave Area Chart (Reference Image 2 & 3) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-dark-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tren Fluktuasi Gangguan Air
                </h3>
                <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                  Real-Time Wave
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-dark-muted mt-0.5">
                Volume laporan masuk per hari dari seluruh unit pelayanan
              </p>
            </div>

            {/* Period Pills */}
            <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-50 p-1 text-xs font-semibold dark:border-dark-border dark:bg-dark-elevated">
              <button
                type="button"
                onClick={() => setPeriodTab("7D")}
                className={`rounded-lg px-3 py-1 transition ${
                  periodTab === "7D"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-dark-card dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setPeriodTab("1M")}
                className={`rounded-lg px-3 py-1 transition ${
                  periodTab === "1M"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-dark-card dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                1 Bulan
              </button>
              <button
                type="button"
                onClick={() => setPeriodTab("ALL")}
                className={`rounded-lg px-3 py-1 transition ${
                  periodTab === "ALL"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-dark-card dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Semua
              </button>
            </div>
          </div>

          {/* Recharts Curved Spline Wave Area */}
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.trend7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="splineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="splineGradientSecondary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(148, 163, 184, 0.15)"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#splineGradient)"
                  name="Aduan Masuk"
                  activeDot={{ r: 6, fill: "#38bdf8", stroke: "#0284c7", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Donut Status Distribution Chart */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
          <div className="border-b border-slate-100 dark:border-dark-border pb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Distribusi Status Aduan
            </h3>
            <p className="text-xs text-slate-500 dark:text-dark-muted mt-0.5">
              Proporsi tiket dalam alur pengerjaan saat ini
            </p>
          </div>

          <div className="mt-4 flex flex-col items-center justify-center">
            <div className="relative h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "rgba(30, 41, 59, 0.8)",
                      borderRadius: "0.75rem",
                      color: "#ffffff",
                      fontSize: "11px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Centered Total Label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-xl font-black text-slate-900 dark:text-white">
                  {totalStatus}
                </span>
                <span className="text-[10px] font-medium text-slate-400 dark:text-dark-muted">
                  Total Tiket
                </span>
              </div>
            </div>

            {/* Modern Status Legend Pills */}
            <div className="mt-3 grid grid-cols-2 gap-2 w-full text-[11px]">
              {pieData.slice(0, 6).map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 dark:border-dark-border dark:bg-dark-elevated/40"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-slate-600 dark:text-slate-300 font-medium">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 ml-1">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Branch Performance Leaderboard (Inspired by Reference Image 2 Table) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-dark-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Peringkat Beban & Efektivitas Cabang
              </h3>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                12 Unit Pelayanan
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-dark-muted mt-0.5">
              Tingkat penyelesaian gangguan, kepatuhan SLA 24 jam, dan durasi rata-rata
            </p>
          </div>
        </div>

        {/* High-Density Branch Table */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-dark-border text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-dark-muted">
                <th className="pb-3 pl-2">Cabang Pelayanan</th>
                <th className="pb-3 px-3">Beban Aduan</th>
                <th className="pb-3 px-3">Tingkat Tepat Waktu</th>
                <th className="pb-3 px-3">Status SLA</th>
                <th className="pb-3 px-3">Durasi Respons</th>
                <th className="pb-3 pr-2 text-right">Tim Teknisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
              {charts.cabangRanking.map((c, idx) => {
                const completionRate = c.total > 0 ? Math.round((c.responded / c.total) * 100) : 100;
                const isOptimal = c.onTimePercent >= 85;
                const isWarning = c.onTimePercent >= 70 && c.onTimePercent < 85;

                return (
                  <tr
                    key={c.kode}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-dark-elevated/40"
                  >
                    {/* Cabang Name with Initials Avatar */}
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-mono text-xs font-bold text-slate-700 dark:bg-dark-elevated dark:text-slate-200">
                          {c.kode.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            Cabang {c.nama}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ID #{c.kode}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Progress Bar for Load */}
                    <td className="py-3 px-3 min-w-[160px]">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {c.total} Aduan
                        </span>
                        <span className="text-slate-400 font-mono">{completionRate}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-dark-elevated overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(10, completionRate))}%` }}
                        />
                      </div>
                    </td>

                    {/* On Time Percent */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {c.onTimePercent}%
                    </td>

                    {/* SLA Status Pill */}
                    <td className="py-3 px-3">
                      {isOptimal ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Optimal
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Waspada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Kritis
                        </span>
                      )}
                    </td>

                    {/* Avg Response Duration */}
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                      {c.avgResponseText}
                    </td>

                    {/* Avatar Stack for Field Officers (Reference Image 2) */}
                    <td className="py-3 pr-2 text-right">
                      <div className="flex items-center justify-end -space-x-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[9px] font-bold text-white ring-2 ring-white dark:ring-dark-card">
                          T1
                        </div>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-[9px] font-bold text-white ring-2 ring-white dark:ring-dark-card">
                          T2
                        </div>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-slate-200 ring-2 ring-white dark:ring-dark-card">
                          +3
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
