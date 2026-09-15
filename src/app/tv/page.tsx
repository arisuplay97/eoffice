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
  ArrowLeft,
  Maximize2,
  PanelRight,
  PanelRightClose,
  Radio,
  Flame,
} from "lucide-react";
import DalamPengerjaanIcon from "@/components/icons/DalamPengerjaanIcon";
import {
  JENIS_GANGGUAN_LABELS,
  PRIORITAS_LABELS,
  STATUS_LABELS,
} from "@/lib/constants";

export default function TvModePage() {
  const [data, setData] = useState<any | null>(null);
  const [timeText, setTimeText] = useState("");
  const [dateText, setDateText] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState<"split" | "baru" | "proses" | "fokus">("split");

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
    const interval = setInterval(fetchData, 20000); // 20s auto-refresh for TV
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

  // Derive lists safely
  const aduanBaruList =
    data?.tables?.aduanBaru ||
    data?.tables?.terbaru?.filter((a: any) => a.status === "BARU") ||
    [];

  const aduanProsesList =
    data?.tables?.aduanProses ||
    data?.tables?.terbaru?.filter((a: any) =>
      ["DIRESPONS", "PROSES", "DALAM_PENGERJAAN", "KENDALA", "DITUNDA"].includes(a.status)
    ) ||
    [];

  const fokusList = data?.tables?.fokus || [];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#090b0e] text-slate-100 p-5 select-none font-sans">
      {/* TV Header */}
      <header className="flex items-center justify-between border-b border-[#222730] pb-3.5">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-white/20">
            <img
              src="/logo.png"
              alt="Logo PERUMDAM Tirta Ardhia Rinjani"
              className="h-full w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white uppercase">
                SIAGA TIARA — Display Operasional Kantor
              </h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                <Radio className="h-2.5 w-2.5 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              PERUMDAM Tirta Ardhia Rinjani · Monitoring Aduan & Distribusi Air Real-Time
            </p>
          </div>
        </div>

        {/* Header Right: Controls, Jam, Fullscreen, Toggle Sidebar */}
        <div className="flex items-center gap-4">
          {/* View Tab Switcher */}
          <div className="hidden lg:flex items-center rounded-xl bg-slate-900/90 border border-slate-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("split")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "split"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Split (Baru & Proses)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("baru")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "baru"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Aduan Baru ({aduanBaruList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("proses")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "proses"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Pengerjaan ({aduanProsesList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("fokus")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "fokus"
                  ? "bg-rose-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              SLA Kritis ({fokusList.length})
            </button>
          </div>

          {/* Hide/Show Sidebar Button */}
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition shadow-sm ${
              showSidebar
                ? "bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                : "bg-sky-600 border-sky-500 text-white hover:bg-sky-500"
            }`}
            title={showSidebar ? "Sembunyikan Sidebar" : "Tampilkan Sidebar"}
          >
            {showSidebar ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {showSidebar ? "Sembunyikan Sidebar" : "Tampilkan Sidebar"}
            </span>
          </button>

          {/* Clock & Date */}
          <div className="text-right border-l border-slate-800 pl-4">
            <div className="text-[11px] text-slate-400">{dateText}</div>
            <div className="font-mono text-xl font-bold tracking-wider text-sky-400 tabular-nums leading-none mt-0.5">
              {timeText} <span className="text-xs text-slate-500">WITA</span>
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

      {/* KPI Cards Row (4 Cards) */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Aduan Masuk */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/90 p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Aduan Masuk (Bulan Ini)
            </div>
            <div className="mt-1 font-mono text-3xl font-black text-white">
              {data?.cards?.aduanMasuk || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Total laporan pelanggan</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-sky-400" />
          </div>
        </div>

        {/* Dalam Pengerjaan (With Requested Custom SVG Icon) */}
        <div className="rounded-2xl border border-amber-900/40 bg-slate-900/90 p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-amber-400 text-[11px] font-bold uppercase tracking-wider">
              Dalam Pengerjaan
            </div>
            <div className="mt-1 font-mono text-3xl font-black text-amber-400">
              {data?.cards?.aduanAktif || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {data?.cards?.prioritasTinggi || 0} prioritas tinggi
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <DalamPengerjaanIcon className="h-6 w-6" />
          </div>
        </div>

        {/* Lewat Respons SLA */}
        <div className="rounded-2xl border border-rose-900/50 bg-slate-900/90 p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-rose-400 text-[11px] font-bold uppercase tracking-wider">
              Lewat Respons SLA
            </div>
            <div className="mt-1 font-mono text-3xl font-black text-rose-500">
              {data?.cards?.lewatSLA || 0}
            </div>
            <div className="text-[10px] text-rose-400/80 mt-0.5">Melebihi batas 24 jam</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ClockAlert className="h-5 w-5 text-rose-500 animate-pulse" />
          </div>
        </div>

        {/* Aduan Selesai */}
        <div className="rounded-2xl border border-emerald-900/40 bg-slate-900/90 p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
              Aduan Selesai
            </div>
            <div className="mt-1 font-mono text-3xl font-black text-emerald-400">
              {data?.cards?.selesai || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Tuntas terverifikasi</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Main Split Body: Complaints Section & Optional Sidebar */}
      <div className="mt-4 grid flex-1 grid-cols-12 gap-4 overflow-hidden">
        {/* COMPLAINTS MAIN AREA (Expands to 12 cols if sidebar hidden) */}
        <div
          className={`${
            showSidebar ? "col-span-12 lg:col-span-8" : "col-span-12"
          } flex flex-col gap-4 overflow-hidden transition-all duration-300`}
        >
          {/* SPLIT VIEW (SHOWS BOTH ADUAN BARU & DALAM PENGERJAAN SIDE-BY-SIDE) */}
          {activeTab === "split" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* PANEL 1: ADUAN BARU MASUK */}
              <div className="flex flex-col rounded-2xl border border-sky-900/40 bg-slate-900/80 p-4 overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-500 animate-ping" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Aduan Baru Masuk
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 font-mono text-xs font-bold">
                    {aduanBaruList.length} Aduan
                  </span>
                </div>

                <div className="mt-2.5 flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                        <th className="py-2">ID</th>
                        <th>Cabang</th>
                        <th>Pelanggan</th>
                        <th>Gangguan</th>
                        <th>Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {aduanBaruList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500">
                            Tidak ada aduan baru yang menunggu respons saat ini.
                          </td>
                        </tr>
                      ) : (
                        aduanBaruList.slice(0, 8).map((a: any) => (
                          <tr key={a.id} className="hover:bg-slate-800/40">
                            <td className="py-2.5 font-mono font-bold text-sky-400">
                              #{a.id}
                            </td>
                            <td>
                              <div className="font-semibold text-slate-200">{a.cabangNama}</div>
                              <div className="text-[10px] text-slate-500">{a.wilayah}</div>
                            </td>
                            <td>
                              <div className="font-medium text-white truncate max-w-[120px]">
                                {a.namaPelanggan}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {a.noHp || "-"}
                              </div>
                            </td>
                            <td>
                              <span className="text-slate-300">
                                {JENIS_GANGGUAN_LABELS[a.jenisGangguan as keyof typeof JENIS_GANGGUAN_LABELS] || a.jenisGangguan}
                              </span>
                            </td>
                            <td>
                              <span className="inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                                {a.sla?.waktuMasukText ? a.sla.waktuMasukText.split(",")[1] || a.sla.waktuMasukText : "Baru"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PANEL 2: ADUAN DALAM PROSES PENGERJAAN */}
              <div className="flex flex-col rounded-2xl border border-amber-900/40 bg-slate-900/80 p-4 overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <DalamPengerjaanIcon className="h-4 w-4" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Dalam Proses Pengerjaan
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold">
                    {aduanProsesList.length} Dikerjakan
                  </span>
                </div>

                <div className="mt-2.5 flex-1 overflow-y-auto">
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
                      {aduanProsesList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500">
                            Tidak ada aduan yang sedang dalam pengerjaan saat ini.
                          </td>
                        </tr>
                      ) : (
                        aduanProsesList.slice(0, 8).map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-800/40">
                            <td className="py-2.5 font-mono font-bold text-amber-400">
                              #{p.id}
                            </td>
                            <td>
                              <div className="font-semibold text-slate-200">{p.cabangNama}</div>
                              <div className="text-[10px] text-slate-500">{p.wilayah}</div>
                            </td>
                            <td>
                              <div className="font-medium text-white truncate max-w-[120px]">
                                {p.namaPelanggan}
                              </div>
                              <div className="text-[10px] text-amber-400/90 font-medium">
                                {STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] || p.status}
                              </div>
                            </td>
                            <td>
                              <span className="text-slate-300">
                                {JENIS_GANGGUAN_LABELS[p.jenisGangguan as keyof typeof JENIS_GANGGUAN_LABELS] || p.jenisGangguan}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                                  p.sla?.statusCode === "ACTIVE_LATE"
                                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                                    : p.sla?.statusCode === "ACTIVE_NEAR"
                                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                                    : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                }`}
                              >
                                {p.sla?.selisihText || p.sla?.durationHours + " jam"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FULL FOCUS VIEW: ADUAN BARU */}
          {activeTab === "baru" && (
            <div className="flex flex-col rounded-2xl border border-sky-900/40 bg-slate-900/80 p-5 flex-1 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-sky-500 animate-ping" />
                  <h2 className="text-base font-bold text-white uppercase tracking-wider">
                    Daftar Lengkap Aduan Baru Masuk
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold text-sky-400">
                  {aduanBaruList.length} Tiket
                </span>
              </div>
              <div className="mt-3 flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-2.5">ID Tiket</th>
                      <th>Cabang</th>
                      <th>Pelanggan</th>
                      <th>No. Telepon / WA</th>
                      <th>Jenis Gangguan</th>
                      <th>Prioritas</th>
                      <th>Waktu Masuk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {aduanBaruList.map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-800/40">
                        <td className="py-3 font-mono font-bold text-sky-400">#{a.id}</td>
                        <td className="font-semibold text-slate-200">{a.cabangNama}</td>
                        <td className="font-semibold text-white">{a.namaPelanggan}</td>
                        <td className="font-mono text-slate-300">{a.noHp || "-"}</td>
                        <td className="text-slate-300">{JENIS_GANGGUAN_LABELS[a.jenisGangguan as keyof typeof JENIS_GANGGUAN_LABELS] || a.jenisGangguan}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            a.prioritas === "DARURAT" ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" : "bg-slate-800 text-slate-300"
                          }`}>
                            {a.prioritas}
                          </span>
                        </td>
                        <td className="font-mono text-slate-400">{a.sla?.waktuMasukText || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FULL FOCUS VIEW: DALAM PROSES PENGERJAAN */}
          {activeTab === "proses" && (
            <div className="flex flex-col rounded-2xl border border-amber-900/40 bg-slate-900/80 p-5 flex-1 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <DalamPengerjaanIcon className="h-5 w-5" />
                  <h2 className="text-base font-bold text-white uppercase tracking-wider">
                    Daftar Lengkap Aduan Dalam Proses Pengerjaan
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold text-amber-400">
                  {aduanProsesList.length} Tiket
                </span>
              </div>
              <div className="mt-3 flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-2.5">ID Tiket</th>
                      <th>Cabang</th>
                      <th>Pelanggan</th>
                      <th>Gangguan</th>
                      <th>Status Pengerjaan</th>
                      <th>Sisa / Durasi SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {aduanProsesList.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="py-3 font-mono font-bold text-amber-400">#{p.id}</td>
                        <td className="font-semibold text-slate-200">{p.cabangNama}</td>
                        <td>
                          <div className="font-semibold text-white">{p.namaPelanggan}</div>
                          <div className="text-[10px] text-slate-500">{p.wilayah}</div>
                        </td>
                        <td className="text-slate-300">{JENIS_GANGGUAN_LABELS[p.jenisGangguan as keyof typeof JENIS_GANGGUAN_LABELS] || p.jenisGangguan}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
                            {STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] || p.status}
                          </span>
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            p.sla?.statusCode === "ACTIVE_LATE" ? "bg-rose-950 text-rose-300" : "bg-emerald-950 text-emerald-300"
                          }`}>
                            {p.sla?.selisihText || "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FULL FOCUS VIEW: SLA KRITIS */}
          {activeTab === "fokus" && (
            <div className="flex flex-col rounded-2xl border border-rose-900/40 bg-slate-900/80 p-5 flex-1 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-rose-500 animate-pulse" />
                  <h2 className="text-base font-bold text-white uppercase tracking-wider">
                    Fokus Penanganan Kritis (Overdue & Mendekati Batas SLA)
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold text-rose-400">
                  {fokusList.length} Tiket
                </span>
              </div>
              <div className="mt-3 flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-2.5">ID Tiket</th>
                      <th>Cabang</th>
                      <th>Pelanggan</th>
                      <th>Gangguan</th>
                      <th>Prioritas</th>
                      <th>Status SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {fokusList.map((f: any) => (
                      <tr key={f.id} className="hover:bg-slate-800/40">
                        <td className="py-3 font-mono font-bold text-rose-400">#{f.id}</td>
                        <td className="font-semibold text-slate-200">{f.cabangNama}</td>
                        <td>
                          <div className="font-semibold text-white">{f.namaPelanggan}</div>
                          <div className="text-[10px] text-slate-500">{f.wilayah}</div>
                        </td>
                        <td className="text-slate-300">{f.jenisGangguan}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            {f.prioritas}
                          </span>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                            {f.sla?.selisihText || "LEWAT SLA"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* OPTIONAL SIDEBAR: LEADERBOARD & RINGKASAN CABANG (COLLAPSIBLE) */}
        {showSidebar && (
          <div className="col-span-12 lg:col-span-4 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/85 p-4 overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-sky-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Leaderboard Cabang
                </h2>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Target &ge; 70%</span>
            </div>

            <div className="mt-2.5 flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2 w-8 text-center">#</th>
                    <th>Cabang</th>
                    <th className="text-center">Tepat</th>
                    <th>Rata-Rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.charts?.cabangRanking?.slice(0, 10).map((c: any, idx: number) => (
                    <tr key={c.kode} className="hover:bg-slate-800/40">
                      <td className="py-2 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="font-semibold text-white">
                        <div className="truncate max-w-[130px]">{c.nama}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {c.total} aduan ({c.onTime} tepat)
                        </div>
                      </td>
                      <td className="text-center">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 font-mono text-xs font-bold ${
                            c.onTimePercent >= 70
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : c.onTimePercent >= 50
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : "bg-rose-950 text-rose-300 border border-rose-800"
                          }`}
                        >
                          {c.onTimePercent}%
                        </span>
                      </td>
                      <td className="font-mono text-slate-400 text-xs">
                        {c.avgResponseText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Summary Footer */}
            <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800">
                <span className="block text-[10px] text-slate-400 font-medium">RESPONS AWAL</span>
                <span className="font-mono text-sm font-bold text-sky-400">
                  {data?.cards?.responsAwal || 0}%
                </span>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800">
                <span className="block text-[10px] text-slate-400 font-medium">KEPATUHAN SLA</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {data?.cards?.responsTepatWaktu || 0}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
