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
    <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-neutral-200/50 bg-white/80 px-5 backdrop-blur-xl dark:border-neutral-800/50 dark:bg-neutral-900/80 transition-colors">
      {/* Left: Mobile Menu & Page Title */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 lg:hidden transition"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">
            Dashboard Monitoring Gangguan
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="relative hidden md:block w-64 lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Cari ID tiket, pelanggan, lokasi..."
            className="input-premium w-full rounded-xl border border-neutral-200/60 bg-neutral-50/50 pl-9 pr-8 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 hover:border-neutral-300 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-700/40 dark:bg-neutral-800/30 dark:text-neutral-200 dark:placeholder:text-neutral-500 dark:hover:border-neutral-600 dark:focus:border-blue-500 dark:focus:bg-neutral-800/60"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange && onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
            >
              Clear
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500">
              /
            </kbd>
          )}
        </div>

        {/* Primary: + Input Aduan */}
        <button
          type="button"
          onClick={onOpenInputAduan}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Input Aduan</span>
        </button>

        {/* Secondary: Export */}
        <button
          type="button"
          onClick={onOpenExport}
          title="Export Laporan Excel/PDF"
          className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white hover:bg-neutral-50 text-neutral-700 dark:border-neutral-700/40 dark:bg-neutral-800/50 dark:text-neutral-300 dark:hover:bg-neutral-700/50 px-3.5 py-2 text-sm font-medium shadow-sm transition-all"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Laporan</span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-neutral-200/60 dark:bg-neutral-700/40 mx-0.5" />

        {/* Icon Buttons Group */}
        {[
          { icon: Tv, onClick: () => router.push("/tv"), title: "Mode TV Display" },
        ].map(({ icon: Icon, onClick, title }) => (
          <button
            key={title}
            type="button"
            onClick={onClick}
            title={title}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        ))}

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
            title="Notifikasi Gangguan"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-neutral-900">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "light" ? "Mode Gelap" : "Mode Terang"}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
        >
          {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </button>

        {/* Settings */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Pengaturan Sistem"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        )}

        {/* Divider */}
        <div className="h-6 w-px bg-neutral-200/60 dark:bg-neutral-700/40 mx-0.5" />

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 font-bold text-xs text-white dark:from-neutral-200 dark:to-neutral-400 dark:text-neutral-900 ring-2 ring-neutral-200/50 dark:ring-neutral-700/50">
            {user?.nama ? user.nama.slice(0, 1).toUpperCase() : "A"}
          </div>
          <span className="hidden md:inline text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[120px]">
            {user?.nama || "Administrator"}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            title="Keluar dari Akun"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
