"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Droplets,
  MapPin,
  Phone,
  User,
  Volume2,
  VolumeX,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type { AduanBaru } from "@/hooks/useAduanBaru";
import {
  JENIS_GANGGUAN_LABELS,
  SUMBER_ADUAN_LABELS,
  PRIORITAS_LABELS,
} from "@/lib/constants";

interface AnnouncementPopupProps {
  items: AduanBaru[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onViewDetail?: (id: string) => void;
  onDashboardRefresh?: () => void;
}

// ── Prioritas config ──────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  string,
  {
    headerText: string;
    headerIcon: React.ReactNode;
    glowColor: string;
    borderColor: string;
    bgAccent: string;
    textAccent: string;
    badgeClass: string;
    ringClass: string;
  }
> = {
  DARURAT: {
    headerText: "ADUAN DARURAT MASUK!",
    headerIcon: <AlertTriangle className="h-5 w-5" />,
    glowColor: "shadow-[0_0_40px_rgba(239,68,68,0.35),0_0_80px_rgba(239,68,68,0.15)]",
    borderColor: "border-red-500/60",
    bgAccent: "bg-red-500/10",
    textAccent: "text-red-500",
    badgeClass: "bg-red-500 text-white animate-flash-badge",
    ringClass: "ring-red-500/30",
  },
  TINGGI: {
    headerText: "ADUAN PRIORITAS TINGGI MASUK!",
    headerIcon: <AlertTriangle className="h-5 w-5" />,
    glowColor: "shadow-[0_0_40px_rgba(245,158,11,0.35),0_0_80px_rgba(245,158,11,0.15)]",
    borderColor: "border-amber-500/60",
    bgAccent: "bg-amber-500/10",
    textAccent: "text-amber-500",
    badgeClass: "bg-amber-500 text-white animate-flash-badge",
    ringClass: "ring-amber-500/30",
  },
  SEDANG: {
    headerText: "Aduan Baru Masuk",
    headerIcon: <Bell className="h-5 w-5" />,
    glowColor: "shadow-[0_0_30px_rgba(59,130,246,0.3),0_0_60px_rgba(59,130,246,0.1)]",
    borderColor: "border-blue-500/50",
    bgAccent: "bg-blue-500/10",
    textAccent: "text-blue-500",
    badgeClass: "bg-blue-500 text-white",
    ringClass: "ring-blue-500/30",
  },
  RENDAH: {
    headerText: "Aduan Baru Masuk",
    headerIcon: <Bell className="h-5 w-5" />,
    glowColor: "shadow-[0_0_25px_rgba(16,185,129,0.25),0_0_50px_rgba(16,185,129,0.1)]",
    borderColor: "border-emerald-500/50",
    bgAccent: "bg-emerald-500/10",
    textAccent: "text-emerald-500",
    badgeClass: "bg-emerald-500 text-white",
    ringClass: "ring-emerald-500/30",
  },
};

function getPriorityConfig(prioritas: string) {
  return PRIORITY_CONFIG[prioritas] || PRIORITY_CONFIG.SEDANG;
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

// ── Audio alarm via Web Audio API ────────────────────────────
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
      const now = ctx.currentTime;

      // 3-tone alert: 880Hz → 1100Hz → 880Hz
      const frequencies = [880, 1100, 880];
      const noteDuration = 0.12;
      const noteGap = 0.04;

      frequencies.forEach((freq, i) => {
        const startTime = now + i * (noteDuration + noteGap);

        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        // Envelope: quick attack, sustain, quick release
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gain.gain.setValueAtTime(0.3, startTime + noteDuration - 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + noteDuration);

        osc.connect(gain);
        gain.connect(ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + noteDuration + 0.01);
      });
    } catch {
      // Audio context error, ignore
    }
  }

  return {
    start: () => {
      if (playing) return;
      try {
        ctx = new AudioContext();
        playing = true;
        // Play immediately
        playBeep();
        // Then loop every 3 seconds
        intervalId = setInterval(playBeep, 3000);
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

// ── Main Component ───────────────────────────────────────────
export default function AnnouncementPopup({
  items,
  onDismiss,
  onDismissAll,
  onViewDetail,
  onDashboardRefresh,
}: AnnouncementPopupProps) {
  const alarmRef = useRef<ReturnType<typeof createAlarmSound> | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeNow, setTimeNow] = useState(Date.now());

  // Keep time updated for "X menit lalu" display
  useEffect(() => {
    const timer = setInterval(() => setTimeNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // Start alarm sound when items appear
  useEffect(() => {
    if (items.length === 0) {
      // Cleanup when no items
      if (alarmRef.current) {
        alarmRef.current.stop();
        alarmRef.current = null;
      }
      setAudioBlocked(false);
      return;
    }

    // Try to start alarm
    if (!alarmRef.current) {
      const alarm = createAlarmSound();
      alarmRef.current = alarm;

      try {
        alarm.start();
        // Check if AudioContext is actually running (not blocked by autoplay)
        setTimeout(() => {
          if (!alarm.isPlaying()) {
            setAudioBlocked(true);
          }
        }, 100);
      } catch {
        setAudioBlocked(true);
      }
    }

    return () => {
      // Don't cleanup here — only cleanup when items become empty
    };
  }, [items.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (alarmRef.current) {
        alarmRef.current.stop();
        alarmRef.current = null;
      }
    };
  }, []);

  // Reset index when items change
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
    setAudioBlocked(false);
  }, []);

  const handleClose = useCallback(() => {
    if (alarmRef.current) {
      alarmRef.current.stop();
      alarmRef.current = null;
    }
    onDismissAll();
    onDashboardRefresh?.();
  }, [onDismissAll, onDashboardRefresh]);

  const handleDismissCurrent = useCallback(() => {
    if (items.length <= 1) {
      handleClose();
      return;
    }
    const currentItem = items[currentIndex];
    if (currentItem) {
      onDismiss(currentItem.id);
      if (currentIndex >= items.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    }
  }, [items, currentIndex, handleClose, onDismiss]);

  const handleViewDetail = useCallback(() => {
    const currentItem = items[currentIndex];
    if (currentItem && onViewDetail) {
      handleClose();
      onViewDetail(currentItem.id);
    }
  }, [items, currentIndex, onViewDetail, handleClose]);

  if (items.length === 0) return null;

  const aduan = items[currentIndex] || items[0];
  const config = getPriorityConfig(aduan.prioritas);
  const isUrgent = aduan.prioritas === "DARURAT" || aduan.prioritas === "TINGGI";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 announcement-overlay">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Popup Card */}
      <div
        className={`
          relative w-full max-w-md rounded-2xl border-2 ${config.borderColor}
          bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl
          ${config.glowColor} animate-slide-in-scale
          ring-1 ${config.ringClass}
          overflow-hidden
        `}
      >
        {/* Pulse glow border animation */}
        <div className={`absolute inset-0 rounded-2xl animate-pulse-glow ${config.borderColor} pointer-events-none`} />

        {/* Header */}
        <div className={`relative px-5 pt-5 pb-4`}>
          {/* Bell icon with shake + ripple */}
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              {/* Ripple pulse circles */}
              <div className={`absolute inset-0 rounded-full ${config.bgAccent} animate-ripple-pulse`} />
              <div className={`absolute inset-0 rounded-full ${config.bgAccent} animate-ripple-pulse`} style={{ animationDelay: "0.5s" }} />
              <div
                className={`
                  relative flex h-12 w-12 items-center justify-center rounded-full
                  ${config.bgAccent} ${config.textAccent}
                  ${isUrgent ? "animate-bell-shake" : ""}
                `}
              >
                {config.headerIcon}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className={`text-base font-bold ${config.textAccent} leading-tight`}>
                {config.headerText}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {timeAgo(aduan.waktuMasuk)} • via {SUMBER_ADUAN_LABELS[aduan.sumberAduan as keyof typeof SUMBER_ADUAN_LABELS] || aduan.sumberAduan}
              </p>
            </div>

            {/* Audio status / Close */}
            <div className="flex items-center gap-1 shrink-0">
              {audioBlocked && (
                <button
                  type="button"
                  onClick={handleUnblockAudio}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300 transition"
                  title="Aktifkan Suara"
                >
                  <VolumeX className="h-4 w-4" />
                </button>
              )}
              {!audioBlocked && items.length > 0 && (
                <div className={`flex h-8 w-8 items-center justify-center ${config.textAccent}`} title="Suara alarm aktif">
                  <Volume2 className="h-4 w-4 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-200/60 dark:bg-neutral-700/40 mx-5" />

        {/* Content */}
        <div className="px-5 py-4 space-y-3">
          {/* Ticket ID + Priority Badge */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-neutral-800 dark:text-neutral-200 tracking-wide">
              #{aduan.id}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.badgeClass}`}>
              {PRIORITAS_LABELS[aduan.prioritas as keyof typeof PRIORITAS_LABELS] || aduan.prioritas}
            </span>
          </div>

          {/* Info rows */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-neutral-400 dark:text-neutral-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Pelanggan</p>
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                  {aduan.namaPelanggan}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Droplets className="h-4 w-4 text-neutral-400 dark:text-neutral-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Gangguan</p>
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  {JENIS_GANGGUAN_LABELS[aduan.jenisGangguan as keyof typeof JENIS_GANGGUAN_LABELS] || aduan.jenisGangguan}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-neutral-400 dark:text-neutral-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Cabang & Wilayah</p>
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  {aduan.cabangNama} — {aduan.wilayah}
                </p>
              </div>
            </div>

            {aduan.keterangan && aduan.keterangan.length > 0 && (
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-neutral-400 dark:text-neutral-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Keterangan</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                    {aduan.keterangan}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Multi-aduan navigation */}
        {items.length > 1 && (
          <>
            <div className="h-px bg-neutral-200/60 dark:bg-neutral-700/40 mx-5" />
            <div className="px-5 py-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300 transition disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {currentIndex + 1} dari {items.length} aduan baru
              </span>
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
                disabled={currentIndex === items.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300 transition disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="h-px bg-neutral-200/60 dark:bg-neutral-700/40" />
        <div className="px-5 py-4 flex items-center gap-3">
          {onViewDetail && (
            <button
              type="button"
              onClick={handleViewDetail}
              className="flex-1 rounded-xl border border-neutral-200/60 bg-white hover:bg-neutral-50 text-neutral-700 dark:border-neutral-700/40 dark:bg-neutral-800/50 dark:text-neutral-300 dark:hover:bg-neutral-700/50 px-4 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              Lihat Detail
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className={`
              flex-1 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-all active:scale-[0.98]
              ${isUrgent
                ? "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
                : "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              <X className="h-4 w-4" />
              Tutup & Tandai Dibaca
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
