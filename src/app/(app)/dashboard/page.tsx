"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import HeroSection from "@/components/HeroSection";
import TablesSection from "@/components/TablesSection";
import BottomAnalyticsSection from "@/components/BottomAnalyticsSection";
import ModalInputAduan from "@/components/ModalInputAduan";
import ModalAksiAduan from "@/components/ModalAksiAduan";
import ModalAlihkanCabang from "@/components/ModalAlihkanCabang";
import ModalDetailAduan from "@/components/ModalDetailAduan";
import ModalExportLaporan from "@/components/ModalExportLaporan";
import ModalPengaturan from "@/components/ModalPengaturan";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterCabang, setFilterCabang] = useState("Semua");
  const [filterWilayah, setFilterWilayah] = useState("Semua");
  const [filterPeriod, setFilterPeriod] = useState("this_month");
  const [filterSelesaiPeriod, setFilterSelesaiPeriod] = useState("bulan_ini");

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [modalInputOpen, setModalInputOpen] = useState(false);
  const [selectedAksiAduan, setSelectedAksiAduan] = useState<any | null>(null);
  const [selectedAlihkanAduan, setSelectedAlihkanAduan] = useState<any | null>(null);
  const [detailAduanId, setDetailAduanId] = useState<string | null>(null);
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [modalSettingsOpen, setModalSettingsOpen] = useState(false);

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams({
        cabang: filterCabang,
        wilayah: filterWilayah,
        period: filterPeriod,
        selesaiPeriod: filterSelesaiPeriod,
      });
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Gagal memuat data dashboard.");
      }
      setData(json);
      setRefreshCountdown(60);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [filterCabang, filterWilayah, filterPeriod, filterSelesaiPeriod]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Refresh Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchDashboardData(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  const handleResetFilter = () => {
    setFilterCabang("Semua");
    setFilterWilayah("Semua");
    setFilterPeriod("this_month");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-app)] text-neutral-900 dark:text-neutral-100 transition-colors duration-150">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        canSeeAll={data?.user?.canSeeAll ?? true}
        filterCabang={filterCabang}
        setFilterCabang={setFilterCabang}
        filterWilayah={filterWilayah}
        setFilterWilayah={setFilterWilayah}
        filterPeriod={filterPeriod}
        setFilterPeriod={setFilterPeriod}
        onApplyFilter={() => fetchDashboardData()}
        onResetFilter={handleResetFilter}
        onOpenInputAduan={() => setModalInputOpen(true)}
        summary={{
          aduanBulanIni: data?.cards?.aduanMasuk || 0,
          prioritasTinggi: data?.cards?.prioritasTinggi || 0,
          lewatSLA: data?.cards?.lewatSLA || 0,
        }}
        crmOpenCount={data?.chatAdmin?.openCount || 0}
        user={data?.user}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <Header
          user={
            data?.user || {
              nama: "Memuat...",
              role: "Staf",
              canSeeAll: false,
            }
          }
          onRefresh={() => fetchDashboardData()}
          onOpenInputAduan={() => setModalInputOpen(true)}
          onOpenExport={() => setModalExportOpen(true)}
          onOpenSettings={
            data?.user?.canSeeAll ? () => setModalSettingsOpen(true) : undefined
          }
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          refreshSeconds={refreshCountdown}
          unreadCount={data?.chatAdmin?.openCount || 0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Scrollable Dashboard View */}
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-7 space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => fetchDashboardData()}
                className="underline hover:no-underline"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Active Live Alerts */}
          {data?.chatAdmin?.openCount > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-900 dark:text-sky-200 shadow-sm">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="h-4 w-4 text-sky-600 dark:text-sky-400 animate-pulse" />
                <span>
                  Terdapat <strong>{data.chatAdmin.openCount} pesan WhatsApp pelanggan</strong> yang
                  meminta bantuan admin dan belum ditanggapi.
                </span>
              </div>
              <Link
                href="/crm"
                className="font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0 ml-3"
              >
                Buka CRM Inbox &rarr;
              </Link>
            </div>
          )}

          {/* 1. TOP HERO: GREETING + 5 HORIZONTAL KPI METRIC CARDS + DUAL SPLINE WAVE CHART */}
          <HeroSection
            user={data?.user || { nama: "Administrator", role: "ADMIN_PUSAT" }}
            cards={
              data?.cards || {
                aduanMasuk: 0,
                aduanAktif: 0,
                lewatSLA: 0,
                selesai: 0,
                prioritasTinggi: 0,
                cabangTerbaik: { nama: "-", persen: "0%", durasi: "-", total: 0 },
                responsAwal: 0,
                responsTepatWaktu: 0,
              }
            }
            trendData={data?.charts?.trend7Days || []}
          />

          {/* 2. CARD POSISI ADUAN (TABLES SECTION) */}
          <TablesSection
            tables={
              data?.tables || {
                fokus: [],
                terbaru: [],
                selesai: [],
              }
            }
            canSeeAll={data?.user?.canSeeAll ?? true}
            selesaiPeriod={filterSelesaiPeriod}
            setSelesaiPeriod={setFilterSelesaiPeriod}
            onOpenAksi={(aduan) => setSelectedAksiAduan(aduan)}
            onOpenAlihkan={(aduan) => setSelectedAlihkanAduan(aduan)}
            onOpenDetail={(id) => setDetailAduanId(id)}
            externalSearchQuery={searchQuery}
          />

          {/* 3. BOTTOM ANALYTICS: DISTRIBUSI STATUS ADUAN (LIST) + AGING GANGGUAN + CABANG TERBANYAK + PERINGKAT CABANG */}
          <BottomAnalyticsSection
            statusCounts={data?.charts?.statusCounts || {}}
            cabangRanking={data?.charts?.cabangRanking || []}
          />

          <div className="h-6" />
        </main>
      </div>

      {/* MODALS */}
      <ModalInputAduan
        isOpen={modalInputOpen}
        onClose={() => setModalInputOpen(false)}
        onSuccess={() => fetchDashboardData()}
        userCabangId={data?.user?.cabangId}
        canSeeAll={data?.user?.canSeeAll ?? true}
      />

      <ModalAksiAduan
        aduan={selectedAksiAduan}
        isOpen={!!selectedAksiAduan}
        onClose={() => setSelectedAksiAduan(null)}
        onSuccess={() => fetchDashboardData()}
      />

      <ModalAlihkanCabang
        aduan={selectedAlihkanAduan}
        isOpen={!!selectedAlihkanAduan}
        onClose={() => setSelectedAlihkanAduan(null)}
        onSuccess={() => fetchDashboardData()}
      />

      <ModalDetailAduan
        aduanId={detailAduanId}
        isOpen={!!detailAduanId}
        onClose={() => setDetailAduanId(null)}
      />

      <ModalExportLaporan
        isOpen={modalExportOpen}
        onClose={() => setModalExportOpen(false)}
        user={data?.user}
      />

      {data?.user?.canSeeAll && (
        <ModalPengaturan
          isOpen={modalSettingsOpen}
          onClose={() => setModalSettingsOpen(false)}
        />
      )}
    </div>
  );
}
