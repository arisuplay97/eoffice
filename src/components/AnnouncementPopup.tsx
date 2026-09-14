"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import type { AduanBaru } from "@/hooks/useAduanBaru";
import {
  JENIS_GANGGUAN_LABELS,
  SUMBER_ADUAN_LABELS,
  PRIORITAS_LABELS,
} from "@/lib/constants";
import WarningLottie from "@/components/WarningLottie";

interface AnnouncementPopupProps {
  items: AduanBaru[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onViewDetail?: (id: string) => void;
  onDashboardRefresh?: () => void;
}

// ── Time ago helper ──────────────────────────────────────────
function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "Baru saja";
  if (seconds < 60) return `${seconds} detik lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  return `${Math.floor(minutes / 60)} jam lalu`;
}

// ── Audio alarm via Web Audio API (repeats until dismissed) ───
function createAlarmSound(): {
  start: () => void;
  stop: () => void;
  isPlaying: () => boolean;
} {
  let ctx: AudioContext | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let playing = false;

  function playBeep() {
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      // 3-tone high alert pattern: 900Hz → 1200Hz → 900Hz
      const frequencies = [900, 1200, 900];
      const noteDuration = 0.12;
      const noteGap = 0.04;

      frequencies.forEach((freq, i) => {
        const startTime = now + i * (noteDuration + noteGap);
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.01);
        gain.gain.setValueAtTime(0.35, startTime + noteDuration - 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + noteDuration);

        osc.connect(gain);
        gain.connect(ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + noteDuration + 0.01);
      });
    } catch {
      // Audio error ignored
    }
  }

  return {
    start: () => {
      if (playing) return;
      try {
        ctx = new AudioContext();
        playing = true;
        playBeep();
        // Loop siren every 2.8 seconds
        intervalId = setInterval(playBeep, 2800);
      } catch {
        // AudioContext not available
      }
    },
    stop: () => {
      playing = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
    isPlaying: () => playing,
  };
}

export default function AnnouncementPopup({
  items,
  onDismiss,
  onDismissAll,
  onViewDetail,
  onDashboardRefresh,
}: AnnouncementPopupProps) {
  const alarmRef = useRef<ReturnType<typeof createAlarmSound> | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-start alarm sound when items exist
  useEffect(() => {
    if (items.length === 0) {
      if (alarmRef.current) {
        alarmRef.current.stop();
        alarmRef.current = null;
      }
      setAudioBlocked(false);
      return;
    }

    if (!isMuted && !alarmRef.current) {
      const alarm = createAlarmSound();
      alarmRef.current = alarm;

      try {
        alarm.start();
        setTimeout(() => {
          if (!alarm.isPlaying()) {
            setAudioBlocked(true);
          }
        }, 150);
      } catch {
        setAudioBlocked(true);
      }
    }
  }, [items.length, isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (alarmRef.current) {
        alarmRef.current.stop();
        alarmRef.current = null;
      }
    };
  }, []);

  // Sync index if items change
  useEffect(() => {
    if (currentIndex >= items.length) {
      setCurrentIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, currentIndex]);

  const handleUnblockAudio = useCallback(() => {
    if (alarmRef.current) {
      alarmRef.current.stop();
    }
    const alarm = createAlarmSound();
    alarmRef.current = alarm;
    alarm.start();
    setIsMuted(false);
    setAudioBlocked(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (!alarmRef.current) {
        const alarm = createAlarmSound();
        alarmRef.current = alarm;
        alarm.start();
      }
    } else {
      setIsMuted(true);
      if (alarmRef.current) {
        alarmRef.current.stop();
        alarmRef.current = null;
      }
    }
  }, [isMuted]);

  const handleClose = useCallback(() => {
    if (alarmRef.current) {
      alarmRef.current.stop();
      alarmRef.current = null;
    }
    onDismissAll();
    onDashboardRefresh?.();
  }, [onDismissAll, onDashboardRefresh]);

  const handleViewDetail = useCallback(() => {
    const currentItem = items[currentIndex];
    if (currentItem && onViewDetail) {
      if (alarmRef.current) {
        alarmRef.current.stop();
        alarmRef.current = null;
      }
      onDismiss(currentItem.id);
      onViewDetail(currentItem.id);
    }
  }, [items, currentIndex, onViewDetail, onDismiss]);

  if (items.length === 0) return null;

  const aduan = items[currentIndex] || items[0];

  const getPriorityStyle = (prioritas: string) => {
    switch (prioritas) {
      case "DARURAT":
        return "bg-red-500/20 border-red-500/70 text-red-400";
      case "TINGGI":
        return "bg-amber-500/20 border-amber-500/70 text-amber-400";
      case "SEDANG":
        return "bg-blue-500/20 border-blue-500/70 text-blue-400";
      case "RENDAH":
      default:
        return "bg-emerald-500/20 border-emerald-500/70 text-emerald-400";
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 announcement-overlay">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Wide Alert Modal Card */}
      <div
        className="relative w-full max-w-4xl rounded-2xl bg-[#0b0f17] text-slate-100 border-2 border-red-500/50 shadow-[0_0_80px_rgba(239,68,68,0.3)] overflow-hidden animate-slide-in-scale flex flex-col md:flex-row z-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
      >
        {/* Top glowing line */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        {/* LEFT COLUMN: Warning Lottie Animation & Operational Signal */}
        <div className="md:w-72 bg-gradient-to-b from-red-950/50 via-[#120e17] to-[#0b0f17] border-b md:border-b-0 md:border-r border-red-500/25 p-6 flex flex-col items-center justify-between text-center gap-4 shrink-0">
          {/* Lottie Animation (Warning sign & blinking WARNING! text) */}
          <div className="relative w-full flex items-center justify-center pt-2">
            <WarningLottie size={150} />
          </div>

          <div className="space-y-1.5 w-full">
            <span className="inline-block px-2.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-[10px] font-bold tracking-widest uppercase">
              SIAGA DARURAT
            </span>
            <h2 id="alert-dialog-title" className="text-base font-black tracking-tight text-white uppercase">
              Aduan Baru Masuk
            </h2>
            <p className="text-xs text-slate-400 leading-snug">
              Terdapat laporan gangguan yang memerlukan tindakan operasional.
            </p>
          </div>

          {/* Sound Control Button */}
          <div className="w-full">
            {audioBlocked ? (
              <button
                type="button"
                onClick={handleUnblockAudio}
                className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow flex items-center justify-center gap-2"
              >
                <span>🔊</span>
                <span>Aktifkan Suara Alarm</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleMute}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 ${
                  isMuted
                    ? "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white"
                    : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                }`}
              >
                <span>{isMuted ? "🔇" : "🔔"}</span>
                <span>{isMuted ? "Alarm Disenyapkan" : "Sirine Aktif (Klik Senyap)"}</span>
              </button>
            )}
          </div>

          {/* Multi-aduan carousel navigation */}
          {items.length > 1 && (
            <div className="w-full pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition disabled:opacity-30 disabled:pointer-events-none"
              >
                ← Prev
              </button>
              <span className="font-mono text-[11px] font-bold text-slate-300">
                {currentIndex + 1} / {items.length}
              </span>
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
                disabled={currentIndex === items.length - 1}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition disabled:opacity-30 disabled:pointer-events-none"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Clean Dispatch Incident Data & Actions */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between gap-5 bg-[#0b0f17]">
          {/* Header Row: ID Tiket, Priority Badge, Time */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
                KODE TIKET
              </span>
              <span className="font-mono text-xl font-black text-white tracking-wide">
                #{aduan.id}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black tracking-wider uppercase border ${getPriorityStyle(
                  aduan.prioritas
                )}`}
              >
                {PRIORITAS_LABELS[aduan.prioritas as keyof typeof PRIORITAS_LABELS] || aduan.prioritas}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-mono">
                {timeAgo(aduan.waktuMasuk)}
              </span>
            </div>
          </div>

          {/* Clean Structured Data Grid (NO AI SLOP, NO UNNECESSARY ICONS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
              <span className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                NAMA PELANGGAN
              </span>
              <span className="block text-sm font-semibold text-white mt-1 truncate">
                {aduan.namaPelanggan}
              </span>
              <span className="block text-xs font-mono text-slate-400 mt-0.5">
                {aduan.noHp && aduan.noHp !== "-" ? aduan.noHp : "No. HP tidak tertera"}
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
              <span className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                JENIS GANGGUAN
              </span>
              <span className="block text-sm font-semibold text-amber-400 mt-1">
                {JENIS_GANGGUAN_LABELS[aduan.jenisGangguan as keyof typeof JENIS_GANGGUAN_LABELS] ||
                  aduan.jenisGangguan}
              </span>
              <span className="block text-xs text-slate-400 mt-0.5">
                Sumber: {SUMBER_ADUAN_LABELS[aduan.sumberAduan as keyof typeof SUMBER_ADUAN_LABELS] || aduan.sumberAduan}
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:col-span-2 lg:col-span-1">
              <span className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                CABANG & WILAYAH
              </span>
              <span className="block text-sm font-semibold text-white mt-1 truncate">
                {aduan.cabangNama}
              </span>
              <span className="block text-xs text-slate-400 mt-0.5 truncate">
                {aduan.wilayah || "Seluruh Wilayah"}
              </span>
            </div>
          </div>

          {/* Rincian Keterangan / Deskripsi */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
            <span className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
              RINCIAN KETERANGAN PELAPOR
            </span>
            <p className="text-sm text-slate-200 leading-relaxed max-h-24 overflow-y-auto">
              {aduan.keterangan && aduan.keterangan.trim().length > 0
                ? aduan.keterangan
                : "Tidak ada keterangan catatan tambahan dari pelapor."}
            </p>
          </div>

          {/* Action Button Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-semibold transition active:scale-[0.98]"
            >
              {items.length > 1 ? `Tutup Semua (${items.length} Aduan)` : "Tutup Notifikasi"}
            </button>

            {onViewDetail && (
              <button
                type="button"
                onClick={handleViewDetail}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Buka Detail Aduan</span>
                <span className="text-base leading-none font-bold">→</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
