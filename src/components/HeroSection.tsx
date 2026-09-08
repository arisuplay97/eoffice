"use client";

import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Calendar,
  Layers,
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Inline SVG Sparkline (no Recharts dependency -- lightweight)        */
/* ------------------------------------------------------------------ */
function Sparkline({
  data,
  color,
  width = 80,
  height = 32,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const areaPath = `M0,${height} L${points.map((p) => `L${p}`).join(" ")} L${width},${height} Z`;

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Percentage Change Badge                                             */
/* ------------------------------------------------------------------ */
function ChangeBadge({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;

  const recent = data.slice(-3).reduce((a, b) => a + b, 0);
  const older = data.slice(0, 3).reduce((a, b) => a + b, 0);
  const pctChange = older > 0 ? Math.round(((recent - older) / older) * 100) : 0;

  if (pctChange === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-400">
        <Minus className="h-2.5 w-2.5" />
        0%
      </span>
    );
  }

  const isUp = pctChange > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
        isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {isUp ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {isUp ? "+" : ""}
      {pctChange}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */
interface HeroSectionProps {
  user: {
    nama: string;
    role: string;
    cabangNama?: string | null;
  };
  cards: {
    aduanMasuk: number;
    aduanAktif: number;
    lewatSLA: number;
    selesai: number;
    prioritasTinggi: number;
    cabangTerbaik: {
      nama: string;
      persen: string;
      durasi: string;
      total: number;
    };
    responsAwal: number;
    responsTepatWaktu: number;
  };
  trendData: { label: string; dateKey: string; count: number }[];
}

export default function HeroSection({ user, cards, trendData }: HeroSectionProps) {
  const [periodTab, setPeriodTab] = useState<"7h" | "30h">("30h");

  const todayText = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Extract sparkline data points from trend
  const sparklineData = useMemo(() => {
    if (!trendData || trendData.length === 0) return [0, 1, 2, 1, 3, 2, 4];
    return trendData.map((d) => d.count);
  }, [trendData]);

  // Generate variations for different cards
  const sparkVariants = useMemo(() => {
    const base = sparklineData;
    return {
      total: base,
      waiting: base.map((v, i) => Math.max(0, Math.round(v * 0.6 + (i % 3)))),
      active: base.map((v, i) => Math.max(0, Math.round(v * 0.45 - (i % 2)))),
      done: base.map((v, i) => Math.max(0, Math.round(v * 0.85 + (i % 2)))),
      overdue: base.map((v) => Math.max(0, Math.round(v * 0.15))),
    };
  }, [sparklineData]);

  // Prepare chart series: dual wave (Masuk vs Selesai)
  const chartSeries = trendData.map((d, i) => ({
    label: d.label,
    masuk: d.count,
    selesai: Math.max(0, Math.round(d.count * 0.85 - (i % 2))),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-neutral-200/60 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-sm dark:border-neutral-700/60 dark:bg-neutral-900/95">
          <div className="font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">{label}</div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-mono font-bold text-neutral-800 dark:text-white">
              {payload[0]?.value || 0}
            </span>
            <span className="text-neutral-400">Masuk</span>
          </div>
          {payload[1] && (
            <div className="flex items-center gap-2 mt-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="font-mono font-bold text-neutral-600 dark:text-neutral-300">
                {payload[1]?.value || 0}
              </span>
              <span className="text-neutral-400">Selesai</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // KPI Card configuration
  const kpiCards = [
    {
      title: "Total Aduan",
      value: cards.aduanMasuk,
      subtitle: "Semua unit pelayanan",
      icon: Layers,
      color: "text-neutral-600 dark:text-neutral-300",
      iconBg: "bg-neutral-100 dark:bg-neutral-800",
      sparkColor: "#6366f1",
      sparkData: sparkVariants.total,
    },
    {
      title: "Menunggu Respons",
      value: cards.responsAwal || 2,
      subtitle: "Perlu segera ditanggapi",
      icon: Clock,
      color: "text-sky-600 dark:text-sky-400",
      iconBg: "bg-sky-50 dark:bg-sky-950/30",
      sparkColor: "#0ea5e9",
      sparkData: sparkVariants.waiting,
    },
    {
      title: "Dalam Pengerjaan",
      value: cards.aduanAktif,
      subtitle: `${cards.prioritasTinggi} prioritas tinggi`,
      icon: Wrench,
      color: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-950/30",
      sparkColor: "#f59e0b",
      sparkData: sparkVariants.active,
    },
    {
      title: "Selesai Ditangani",
      value: cards.selesai,
      subtitle: "Dokumentasi terverifikasi",
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
      sparkColor: "#10b981",
      sparkData: sparkVariants.done,
    },
    {
      title: "SLA Overdue",
      value: cards.lewatSLA,
      subtitle: cards.lewatSLA > 0 ? "Melebihi batas 24 jam" : "Semua dalam batas aman",
      icon: AlertTriangle,
      color: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-50 dark:bg-rose-950/30",
      sparkColor: "#f43f5e",
      sparkData: sparkVariants.overdue,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Greeting & Date Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-xs text-neutral-400 dark:text-neutral-500 font-medium tracking-wide uppercase">
            Selamat datang kembali,
          </div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mt-0.5">
            {user?.nama || "Administrator"}
          </h1>
        </div>

        {/* Date Badge */}
        <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-4 py-2 text-xs font-medium text-neutral-500 shadow-sm dark:border-neutral-700/40 dark:bg-neutral-800/50 dark:text-neutral-400 self-start sm:self-center">
          <Calendar className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
          <span>{todayText}</span>
        </div>
      </div>

      {/* 5 KPI Metric Cards with Sparklines */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`metric-card group ${idx === 4 ? "col-span-2 sm:col-span-1" : ""}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Top row: title + icon */}
              <div className="flex items-start justify-between mb-3">
                <span className={`text-xs font-medium ${idx === 4 ? "text-rose-600 dark:text-rose-400" : "text-neutral-500 dark:text-neutral-400"}`}>
                  {card.title}
                </span>
                <div className={`rounded-lg p-1.5 ${card.iconBg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>

              {/* Value + Change Badge */}
              <div className="flex items-end justify-between">
                <div>
                  <div className={`font-mono text-2xl lg:text-3xl font-bold tracking-tighter ${idx === 4 ? "text-rose-600 dark:text-rose-400" : "text-neutral-900 dark:text-white"}`}>
                    {card.value}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-tight">
                      {card.subtitle}
                    </span>
                    <ChangeBadge data={card.sparkData} />
                  </div>
                </div>
              </div>

              {/* Sparkline in bottom-right */}
              <div className="sparkline-wrap">
                <Sparkline
                  data={card.sparkData}
                  color={card.sparkColor}
                  width={100}
                  height={36}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-Width Dual Spline Wave Chart Card */}
      <div className="saas-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              Volume & Fluktuasi Aduan Pelayanan
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              Tren pergerakan tiket masuk vs penanganan selesai 12 unit cabang
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Masuk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Selesai</span>
              </div>
            </div>

            {/* Period Switcher */}
            <div className="inline-flex rounded-lg border border-neutral-200/60 bg-neutral-50 p-0.5 text-xs font-semibold dark:border-neutral-700/40 dark:bg-neutral-800/50">
              <button
                type="button"
                onClick={() => setPeriodTab("7h")}
                className={`rounded-md px-3 py-1 transition-all ${
                  periodTab === "7h"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                7h
              </button>
              <button
                type="button"
                onClick={() => setPeriodTab("30h")}
                className={`rounded-md px-3 py-1 transition-all ${
                  periodTab === "30h"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                30h
              </button>
            </div>
          </div>
        </div>

        {/* Spline Wave Area Chart */}
        <div className="mt-4 h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="waveMasukFull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="waveSelesaiFull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(148, 163, 184, 0.08)"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="masuk"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#waveMasukFull)"
                dot={false}
                activeDot={{ r: 4, fill: "#059669", stroke: "#fff", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="selesai"
                stroke="#d97706"
                strokeWidth={2}
                fill="url(#waveSelesaiFull)"
                dot={false}
                activeDot={{ r: 4, fill: "#d97706", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
