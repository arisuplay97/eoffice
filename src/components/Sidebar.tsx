"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  ChevronRight,
  PlusCircle,
  X,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { CABANG_LIST } from "@/lib/constants";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  canSeeAll: boolean;
  filterCabang: string;
  setFilterCabang: (v: string) => void;
  filterWilayah: string;
  setFilterWilayah: (v: string) => void;
  filterPeriod: string;
  setFilterPeriod: (v: string) => void;
  onApplyFilter: () => void;
  onResetFilter: () => void;
  onOpenInputAduan: () => void;
  onOpenSettings?: () => void;
  summary: {
    aduanBulanIni: number;
    prioritasTinggi: number;
    lewatSLA: number;
  };
  crmOpenCount?: number;
  user?: {
    nama: string;
    role: string;
    cabangNama?: string | null;
  };
}

export default function Sidebar({
  isOpen,
  onClose,
  canSeeAll,
  filterCabang,
  setFilterCabang,
  filterWilayah,
  setFilterWilayah,
  filterPeriod,
  setFilterPeriod,
  onApplyFilter,
  onResetFilter,
  onOpenInputAduan,
  onOpenSettings,
  summary,
  crmOpenCount = 0,
  user,
}: SidebarProps) {
  const pathname = usePathname();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-neutral-200/80 bg-[#fdfdfd] dark:border-dark-border dark:bg-dark-card transition-all duration-200 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-neutral-200/80 dark:border-dark-border px-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-neutral-200/80 dark:ring-dark-border">
              <img
                src="/logo.png"
                alt="Logo PERUMDAM Tirta Ardhia Rinjani"
                className="h-full w-auto object-contain"
              />
            </div>
            <div className="truncate">
              <div className="text-base font-bold tracking-tight text-neutral-900 dark:text-white leading-tight">
                SIAGA TIARA
              </div>
              <div className="text-xs text-neutral-500 dark:text-dark-muted truncate leading-tight mt-0.5 font-medium">
                {canSeeAll ? "PDAM TIARA LOTENG" : user?.cabangNama || "Cabang Pelayanan"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-dark-hover lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {/* Main Menu */}
          <div className="space-y-1.5">
            <div className="px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Menu Operasional
            </div>

            <Link
              href="/dashboard"
              onClick={onClose}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                pathname === "/dashboard"
                  ? "bg-neutral-100 text-neutral-900 dark:bg-dark-elevated dark:text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-dark-hover dark:hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
                <span>Dashboard</span>
              </div>
            </Link>

            <Link
              href="/crm"
              onClick={onClose}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                pathname === "/crm"
                  ? "bg-neutral-100 text-neutral-900 font-semibold dark:bg-dark-elevated dark:text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-dark-hover dark:hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>CRM WhatsApp</span>
              </div>
              {crmOpenCount > 0 ? (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                  {crmOpenCount}
                </span>
              ) : (
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              )}
            </Link>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInputAduan();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-dark-hover dark:hover:text-white transition"
            >
              <div className="flex items-center gap-3">
                <PlusCircle className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
                <span>Input Aduan Baru</span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-400" />
            </button>

            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-dark-hover dark:hover:text-white transition"
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-neutral-500" />
                  <span>Pengaturan Sistem</span>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </button>
            )}
          </div>

          {/* Quick Filter Section */}
          <div className="pt-3 border-t border-neutral-200/80 dark:border-dark-border">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filter Wilayah</span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`}
              />
            </button>

            {filterOpen && (
              <div className="mt-3 space-y-3 text-xs">
                {canSeeAll && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                      Cabang Pelayanan
                    </label>
                    <select
                      value={filterCabang}
                      onChange={(e) => setFilterCabang(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:outline-none"
                    >
                      <option value="Semua">Semua Cabang (12 Unit)</option>
                      {CABANG_LIST.map((c) => (
                        <option key={c.kode} value={c.nama}>
                          {c.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                    Rentang Waktu
                  </label>
                  <select
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:outline-none"
                  >
                    <option value="today">Hari Ini</option>
                    <option value="last_7_days">7 Hari Terakhir</option>
                    <option value="this_month">Bulan Ini</option>
                    <option value="all">Semua Periode</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onApplyFilter}
                    className="flex-1 rounded-lg bg-neutral-900 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900 transition hover:opacity-90"
                  >
                    Terapkan
                  </button>
                  <button
                    type="button"
                    onClick={onResetFilter}
                    className="rounded-lg border border-neutral-200 dark:border-dark-border px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-hover"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subtle Footer info */}
        <div className="border-t border-neutral-200/80 dark:border-dark-border p-3.5 text-center text-xs text-neutral-400 font-mono">
          SIAGA TIARA V2.0
        </div>
      </aside>
    </>
  );
}
