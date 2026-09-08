"use client";

import React from "react";
import {
  Inbox,
  ClockAlert,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

interface KpiCardsProps {
  data: {
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
  canSeeAll?: boolean;
}

export default function KpiCards({ data, canSeeAll = true }: KpiCardsProps) {
  const cards = [
    {
      label: "Aduan Masuk",
      value: data.aduanMasuk,
      subtext: "Periode aktif terpilih",
      trendText: "+8% vs bulan lalu",
      trendType: "positive",
      icon: Inbox,
      iconBg: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-200/50 dark:border-sky-500/20",
    },
    {
      label: "Aduan Aktif",
      value: data.aduanAktif,
      subtext: "Proses & pengerjaan teknisi",
      trendText: `${data.prioritasTinggi} prioritas tinggi`,
      trendType: data.prioritasTinggi > 0 ? "warning" : "neutral",
      icon: AlertTriangle,
      iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20",
    },
    {
      label: "Lewat SLA (>24 Jam)",
      value: data.lewatSLA,
      subtext: "Belum direspons tim lapangan",
      trendText: data.lewatSLA > 0 ? "Butuh tindakan segera" : "Semua dalam batas aman",
      trendType: data.lewatSLA > 0 ? "danger" : "positive",
      icon: ClockAlert,
      iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-500/20",
    },
    {
      label: "Aduan Selesai",
      value: data.selesai,
      subtext: "Terverifikasi tuntas di sistem",
      trendText: "Rasio tuntas 92%",
      trendType: "positive",
      icon: CheckCircle2,
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20",
    },
    {
      label: "Respons Awal",
      value: `${data.responsAwal}%`,
      subtext: "Tiket mulai diintervensi",
      trendText: "Kecepatan respons",
      trendType: "neutral",
      icon: TrendingUp,
      iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20",
    },
    {
      label: "Tepat Waktu SLA",
      value: `${data.responsTepatWaktu}%`,
      subtext: "Kepatuhan target <24 jam",
      trendText: "Standar regulasi",
      trendType: "positive",
      icon: ShieldCheck,
      iconBg: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-500/20",
    },
    {
      label: "Cabang Terbaik",
      value: data.cabangTerbaik.persen,
      subtext: data.cabangTerbaik.nama || "Semua Cabang",
      trendText: `Durasi ${data.cabangTerbaik.durasi}`,
      trendType: "positive",
      icon: Zap,
      iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200/50 dark:border-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:border-slate-300 dark:border-dark-border dark:bg-dark-card dark:hover:border-slate-700"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-dark-muted">
                  {card.label}
                </span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white lg:text-3xl tabular-nums">
                {card.value}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-dark-border flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 truncate mr-1" title={card.subtext}>
                {card.subtext}
              </span>

              {card.trendType === "positive" && (
                <span className="inline-flex items-center gap-0.5 font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>{card.trendText}</span>
                </span>
              )}
              {card.trendType === "danger" && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                  <ArrowDownRight className="h-3 w-3" />
                  <span>{card.trendText}</span>
                </span>
              )}
              {card.trendType === "warning" && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                  <Minus className="h-3 w-3" />
                  <span>{card.trendText}</span>
                </span>
              )}
              {card.trendType === "neutral" && (
                <span className="inline-flex items-center gap-0.5 font-medium text-slate-500 dark:text-slate-400 shrink-0">
                  <span>{card.trendText}</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
