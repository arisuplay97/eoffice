"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  Tv,
  Sun,
  Moon,
  Plus,
  Menu,
  FileSpreadsheet,
  Settings,
  LogOut,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface HeaderProps {
  user: {
    nama: string;
    role: string;
    cabangNama?: string | null;
    canSeeAll?: boolean;
  };
  onRefresh: () => void;
  onOpenInputAduan: () => void;
  onOpenExport: () => void;
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
  refreshSeconds: number;
  unreadCount?: number;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export default function Header({
  user,
  onRefresh,
  onOpenInputAduan,
  onOpenExport,
  onOpenSettings,
  onToggleSidebar,
  refreshSeconds,
  unreadCount = 3,
  searchQuery = "",
  onSearchChange,
}: HeaderProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200/80 bg-white/95 px-6 backdrop-blur-md dark:border-dark-border dark:bg-dark-card/95 transition-colors">
      {/* Left: Mobile Menu & Clean Page Title */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-dark-hover lg:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
            Dashboard Monitoring Gangguan
          </span>
        </div>
      </div>

      {/* Right Controls: Search, New Aduan, Export, Mode TV, Dark Mode, Profile */}
      <div className="flex items-center gap-3">
        {/* Realtime Search Input (Fixing bug where it previously opened input modal) */}
        <div className="relative hidden md:block w-72 lg:w-88">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Cari ID tiket, pelanggan, lokasi..."
            className="w-full rounded-lg border border-neutral-200/90 bg-neutral-50/70 pl-9 pr-9 py-2 text-xs lg:text-sm text-neutral-800 placeholder:text-neutral-400 transition hover:border-neutral-300 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-elevated/40 dark:text-neutral-200 dark:placeholder:text-neutral-500"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange && onSearchChange("")}
              className="absolute right-2.5 top-2.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              Clear
            </button>
          ) : (
            <span className="pointer-events-none absolute right-2.5 top-2.5 text-[10px] font-mono text-neutral-400">
              ⌘K
            </span>
          )}
        </div>

        {/* Primary Action: + Input Aduan (Hitam di Light Mode, Putih di Dark Mode) */}
        <button
          type="button"
          onClick={onOpenInputAduan}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm border border-neutral-900 dark:border-white active:scale-[0.98] transition"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Input Aduan</span>
        </button>

        {/* Secondary Action: Export Laporan Button (Modern Enterprise Secondary Button) */}
        <button
          type="button"
          onClick={onOpenExport}
          title="Export Laporan Excel/PDF"
          className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-neutral-300/90 dark:border-dark-border bg-white dark:bg-dark-elevated text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-dark-hover px-3.5 py-2 text-xs sm:text-sm font-semibold shadow-sm transition"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Laporan</span>
        </button>

        {/* Single Mode TV Button (Cukup 1, tidak ada duplikat!) */}
        <button
          type="button"
          onClick={() => router.push("/tv")}
          title="Buka Mode TV Display Kantor"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-dark-hover dark:hover:text-white transition"
        >
          <Tv className="h-4.5 w-4.5" />
        </button>

        {/* Notification Bell with Badge */}
        <div className="relative">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-dark-hover dark:hover:text-white transition"
            title="Notifikasi Gangguan"
          >
            <Bell className="h-4.5 w-4.5" />
          </button>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-dark-card">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Dark Mode Switcher (Moon / Sun) */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "light" ? "Beralih ke Mode Gelap" : "Beralih ke Mode Terang"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-dark-hover dark:hover:text-white transition"
        >
          {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
        </button>

        {/* Settings Button (Admin Pusat) */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Pengaturan Sistem"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-dark-hover dark:hover:text-white transition"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        )}

        <div className="h-5 w-[1px] bg-neutral-200 dark:bg-dark-border mx-1" />

        {/* User Profile Chip */}
        <div className="flex items-center gap-2 pl-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 font-bold text-xs text-white dark:bg-neutral-200 dark:text-neutral-900">
            {user?.nama ? user.nama.slice(0, 1).toUpperCase() : "A"}
          </div>
          <span className="hidden md:inline text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[130px]">
            {user?.nama || "Administrator"}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            title="Keluar dari Akun"
            className="p-1 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
