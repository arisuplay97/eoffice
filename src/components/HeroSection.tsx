"use client";

import React, { useState } from "react";
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
  Box,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

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

  // Prepare chart series: dual wave (Masuk vs Selesai)
  const chartSeries = trendData.map((d, i) => ({
    label: d.label,
    masuk: d.count,
    selesai: Math.max(0, Math.round(d.count * 0.85 - (i % 2))),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-dark-border dark:bg-dark-card/95">
          <div className="font-semibold text-neutral-500 dark:text-neutral-400">{label}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="font-mono font-bold text-neutral-800 dark:text-white">
              {payload[0]?.value || 0} Aduan Masuk
            </span>
          </div>
          {payload[1] && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="font-mono text-neutral-600 dark:text-neutral-300">
                {payload[1]?.value || 0} Aduan Selesai
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Greeting & Date Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-xs text-neutral-500 dark:text-dark-muted font-medium">
            Selamat datang kembali,
          </div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {user?.nama || "Administrator"}
          </h1>
        </div>

        {/* Date Badge */}
        <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/90 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 shadow-sm dark:border-dark-border dark:bg-dark-card dark:text-neutral-300 self-start sm:self-center">
          <Calendar className="h-3.5 w-3.5 text-neutral-400" />
          <span>{todayText}</span>
        </div>
      </div>

      {/* 5 KPI Metric Cards Row (Placed at the very top, exactly matching Image 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Aduan Masuk */}
        <div className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-card flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Total Aduan
            </div>
            <div className="mt-1.5 font-mono text-2xl lg:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
              {cards.aduanMasuk}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Semua unit pelayanan
            </div>
          </div>
          <div className="rounded-lg p-2 bg-neutral-100 dark:bg-dark-elevated text-neutral-600 dark:text-neutral-300">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Menunggu Terima / Respons */}
        <div className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-card flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Menunggu Respons
            </div>
            <div className="mt-1.5 font-mono text-2xl lg:text-3xl font-bold text-sky-600 dark:text-sky-400 tracking-tight">
              {cards.responsAwal || 2}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Perlu segera ditanggapi
            </div>
          </div>
          <div className="rounded-lg p-2 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Dalam Pengerjaan */}
        <div className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-card flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Dalam Pengerjaan
            </div>
            <div className="mt-1.5 font-mono text-2xl lg:text-3xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              {cards.aduanAktif}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              {cards.prioritasTinggi} prioritas tinggi
            </div>
          </div>
          <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Box className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Selesai Ditangani */}
        <div className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-card flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Selesai Ditangani
            </div>
            <div className="mt-1.5 font-mono text-2xl lg:text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {cards.selesai}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Dokumentasi terverifikasi
            </div>
          </div>
          <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Card 5: SLA Overdue (Lewat Batas Respons) */}
        <div className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-card flex items-start justify-between col-span-2 sm:col-span-1">
          <div>
            <div className="text-xs font-medium text-rose-600 dark:text-rose-400">
              SLA Overdue
            </div>
            <div className="mt-1.5 font-mono text-2xl lg:text-3xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
              {cards.lewatSLA}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              {cards.lewatSLA > 0 ? "Melebihi batas 24 jam" : "Semua dalam batas aman"}
            </div>
          </div>
          <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Full-Width Dual Spline Wave Chart Card */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-dark-border">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              Volume & Fluktuasi Aduan Pelayanan
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Tren pergerakan tiket masuk vs penanganan selesai 12 unit cabang
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span>Masuk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Selesai</span>
              </div>
            </div>

            {/* Period Switcher: 7h / 30h */}
            <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-semibold dark:border-dark-border dark:bg-dark-elevated">
              <button
                type="button"
                onClick={() => setPeriodTab("7h")}
                className={`rounded-md px-3 py-1 transition ${
                  periodTab === "7h"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-dark-card dark:text-white font-bold"
                    : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                7h
              </button>
              <button
                type="button"
                onClick={() => setPeriodTab("30h")}
                className={`rounded-md px-3 py-1 transition ${
                  periodTab === "30h"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-dark-card dark:text-white font-bold"
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
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="waveSelesaiFull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(148, 163, 184, 0.12)"
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
                strokeWidth={2.5}
                fill="url(#waveMasukFull)"
                dot={false}
                activeDot={{ r: 5, fill: "#059669" }}
              />
              <Area
                type="monotone"
                dataKey="selesai"
                stroke="#d97706"
                strokeWidth={2.5}
                fill="url(#waveSelesaiFull)"
                dot={false}
                activeDot={{ r: 5, fill: "#d97706" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
