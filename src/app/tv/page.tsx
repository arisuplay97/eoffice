"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Calendar,
  Zap,
  ClockAlert,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Maximize2,
} from "lucide-react";

export default function TvModePage() {
  const [data, setData] = useState<any | null>(null);
  const [timeText, setTimeText] = useState("");
  const [dateText, setDateText] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard?period=this_month");
      const json = await res.json();
      if (res.ok && json.ok) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s refresh for TV display
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeText(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setDateText(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#090b0e] text-slate-100 p-6 select-none">
      {/* TV Header */}
      <header className="flex items-center justify-between border-b border-[#222730] pb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-white/20">
            <img
              src="/logo.png"
              alt="Logo PERUMDAM Tirta Ardhia Rinjani"
              className="h-full w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase">
              SIAGA TIARA — Display Operasional Kantor
            </h1>
            <p className="text-xs text-slate-400">
              PERUMDAM Tirta Ardhia Rinjani · Monitoring Gangguan Air Real-Time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-slate-400">{dateText}</div>
            <div className="font-mono text-2xl font-bold tracking-wider text-sky-400 tabular-nums">
              {timeText} WITA
            </div>
          </div>
          <button
            type="button"
            onClick={toggleFullScreen}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            title="Layar Penuh"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* KPI Cards Row */}
      <div className="mt-5 grid grid-cols-4 gap-4">
        {/* Aduan Masuk */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Aduan Masuk (Bulan Ini)</span>
            <Inbox className="h-5 w-5 text-sky-400" />
          </div>
          <div className="mt-3 font-mono text-4xl font-black text-white">
            {data?.cards?.aduanMasuk || 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Laporan pelanggan terdaftar</div>
        </div>

        {/* Aduan Aktif */}
        <div className="rounded-2xl border border-amber-900/50 bg-slate-900/90 p-5 shadow-lg">
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <span>Dalam Pengerjaan</span>
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <div className="mt-3 font-mono text-4xl font-black text-amber-400">
            {data?.cards?.aduanAktif || 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Sedang ditangani petugas lapangan</div>
        </div>

        {/* Lewat Respons SLA */}
        <div className="rounded-2xl border border-rose-900/60 bg-slate-900/90 p-5 shadow-lg">
          <div className="flex items-center justify-between text-rose-400 text-xs font-semibold uppercase tracking-wider">
            <span>Lewat Respons SLA</span>
            <ClockAlert className="h-5 w-5 text-rose-500 animate-pulse" />
          </div>
          <div className="mt-3 font-mono text-4xl font-black text-rose-500">
            {data?.cards?.lewatSLA || 0}
          </div>
          <div className="mt-1 text-xs text-rose-400/80">Belum direspons &gt; 24 jam</div>
        </div>

        {/* Selesai */}
        <div className="rounded-2xl border border-emerald-900/50 bg-slate-900/90 p-5 shadow-lg">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>Aduan Selesai</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="mt-3 font-mono text-4xl font-black text-emerald-400">
            {data?.cards?.selesai || 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Tuntas terverifikasi</div>
        </div>
      </div>

      {/* Main Split Body: Fokus Penanganan & Cabang Leaderboard */}
      <div className="mt-5 grid flex-1 grid-cols-12 gap-5 overflow-hidden">
        {/* Fokus Penanganan Table (7 Columns) */}
        <div className="col-span-7 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-5 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-600 animate-ping" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Fokus Penanganan Kritis
              </h2>
            </div>
            <span className="font-mono text-xs font-bold text-slate-400">
              {data?.tables?.fokus?.length || 0} Tiket
            </span>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2">ID</th>
                  <th>Cabang</th>
                  <th>Pelanggan</th>
                  <th>Gangguan</th>
                  <th>Status SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {!data?.tables?.fokus?.length ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Tidak ada tiket yang melewati batas respons SLA saat ini.
                    </td>
                  </tr>
                ) : (
                  data.tables.fokus.slice(0, 7).map((f: any) => (
                    <tr key={f.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono font-bold text-sky-400">{f.id}</td>
                      <td className="font-medium text-slate-200">{f.cabangNama}</td>
                      <td>
                        <div className="font-semibold text-white">{f.namaPelanggan}</div>
                        <div className="text-[10px] text-slate-500">{f.wilayah}</div>
                      </td>
                      <td className="text-slate-300">{f.jenisGangguan}</td>
                      <td>
                        <span
                          className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                            f.sla.statusCode === "ACTIVE_LATE"
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {f.sla.selisihText}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cabang Ranking Leaderboard (5 Columns) */}
        <div className="col-span-5 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-5 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-sky-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Leaderboard Respons Cabang
              </h2>
            </div>
            <span className="text-xs text-slate-400">Target &gt;= 70%</span>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2 w-10 text-center">Rank</th>
                  <th>Cabang</th>
                  <th className="text-center">Tepat</th>
                  <th>Rata-Rata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data?.charts?.cabangRanking?.slice(0, 8).map((c: any, idx: number) => (
                  <tr key={c.kode} className="hover:bg-slate-800/40">
                    <td className="py-2 text-center font-mono font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="font-semibold text-white">
                      {c.nama}
                      <span className="ml-1 text-[10px] text-slate-500 font-mono">({c.total} aduan)</span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-mono text-xs font-bold ${
                          c.onTimePercent >= 70
                            ? "bg-emerald-950 text-emerald-300"
                            : c.onTimePercent >= 50
                            ? "bg-amber-950 text-amber-300"
                            : "bg-rose-950 text-rose-300"
                        }`}
                      >
                        {c.onTimePercent}%
                      </span>
                    </td>
                    <td className="font-mono text-slate-400 text-xs">{c.avgResponseText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
