"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  KeyRound,
  Bell,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
} from "lucide-react";

interface ModalPengaturanProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalPengaturan({ isOpen, onClose }: ModalPengaturanProps) {
  const [activeTab, setActiveTab] = useState<"sla" | "users" | "announcements">("sla");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [resetUserId, setResetUserId] = useState("");
  const [newPin, setNewPin] = useState("");

  const [annJudul, setAnnJudul] = useState("");
  const [annIsi, setAnnIsi] = useState("");
  const [annMulai, setAnnMulai] = useState("");
  const [annSelesai, setAnnSelesai] = useState("");

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || "Gagal memuat pengaturan.");
      setData(result);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      setSuccessMessage(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId || !newPin) return;

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_pin",
          userId: resetUserId,
          newPin,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) throw new Error(resData.error || "Gagal reset PIN.");
      showNotification("PIN akun staf berhasil diperbarui.");
      setNewPin("");
      fetchSettings();
    } catch (e: any) {
      setError(e.message || "Gagal reset PIN.");
    }
  };

  const handleToggleUser = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_user",
          userId,
          aktif: !currentStatus,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) throw new Error(resData.error || "Gagal ubah status.");
      showNotification("Status akun berhasil diperbarui.");
      fetchSettings();
    } catch (e: any) {
      setError(e.message || "Gagal ubah status.");
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_announcement",
          judul: annJudul,
          isi: annIsi,
          waktuMulai: annMulai ? new Date(annMulai) : new Date(),
          waktuSelesai: annSelesai ? new Date(annSelesai) : null,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) throw new Error(resData.error || "Gagal buat pengumuman.");
      showNotification("Pengumuman layanan gangguan berhasil diterbitkan.");
      setAnnJudul("");
      setAnnIsi("");
      fetchSettings();
    } catch (e: any) {
      setError(e.message || "Gagal buat pengumuman.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-2xl dark:border-dark-border dark:bg-dark-card my-8 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-dark-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-dark-elevated text-neutral-800 dark:text-white">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Pengaturan Sistem SIAGA TIARA
              </h2>
              <p className="text-xs text-neutral-500 dark:text-dark-muted">
                Konfigurasi parameter SLA 24 jam, akun staf cabang, dan pengumuman layanan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-dark-hover dark:hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback Banners */}
        {successMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Tabs */}
        <div className="mt-5 flex border-b border-neutral-100 dark:border-dark-border gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("sla")}
            className={`flex items-center gap-2 pb-3 px-3 transition border-b-2 ${
              activeTab === "sla"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Parameter SLA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 pb-3 px-3 transition border-b-2 ${
              activeTab === "users"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Akun Staf Cabang</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("announcements")}
            className={`flex items-center gap-2 pb-3 px-3 transition border-b-2 ${
              activeTab === "announcements"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Pengumuman Gangguan</span>
          </button>
        </div>

        {/* Tab 1: SLA Parameters */}
        {activeTab === "sla" && (
          <div className="mt-5 space-y-4 text-xs">
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-elevated/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white">
                    Target Waktu Respons SLA
                  </div>
                  <div className="text-neutral-500 text-[11px] mt-0.5">
                    Batas maksimal respon pertama teknisi sejak aduan masuk (Regulasi V11.10)
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  24 Jam
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-elevated/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white">
                    Batas Ambang Waspada (Warning Threshold)
                  </div>
                  <div className="text-neutral-500 text-[11px] mt-0.5">
                    Aduan otomatis masuk ke tabel Fokus Penanganan bila sisa waktu mencapai ambang ini
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-amber-600">
                  ≤ 6 Jam (25%)
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-elevated/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white">
                    Penguncian Waktu Respons Pertama (Locked Response)
                  </div>
                  <div className="text-neutral-500 text-[11px] mt-0.5">
                    Waktu saat status beralih dari Baru dikunci permanen di database PostgreSQL
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Terkunci Otomatis
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: User Account Management */}
        {activeTab === "users" && (
          <div className="mt-5 space-y-4 text-xs">
            {/* Quick Reset Form */}
            <form onSubmit={handleResetPin} className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-elevated/40">
              <div className="font-semibold text-neutral-900 dark:text-white mb-2">
                Reset PIN Akses 6-Digit Staf Cabang
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={resetUserId}
                  onChange={(e) => setResetUserId(e.target.value)}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Akun Staf --</option>
                  {data?.users?.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.nama} ({u.username})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="PIN Baru 6-Digit (mis. 123456)"
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none"
                  required
                />

                <button
                  type="submit"
                  className="rounded-xl bg-neutral-900 py-2 px-4 font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 transition"
                >
                  Simpan PIN Baru
                </button>
              </div>
            </form>

            {/* List of Accounts */}
            <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-dark-border rounded-xl border border-neutral-200/80 bg-white dark:border-dark-border dark:bg-dark-card">
              {data?.users?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-semibold text-neutral-900 dark:text-white">{u.nama}</div>
                    <div className="text-[11px] text-neutral-400 font-mono">
                      {u.username} · {u.cabang?.nama || "Pusat"}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-neutral-500">
                      PIN: {u.pin || "******"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleUser(u.id, u.aktif)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                        u.aktif
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-neutral-100 text-neutral-500 dark:bg-dark-elevated"
                      }`}
                    >
                      {u.aktif ? "Aktif" : "Nonaktif"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Announcements */}
        {activeTab === "announcements" && (
          <div className="mt-5 space-y-4 text-xs">
            <form onSubmit={handleCreateAnnouncement} className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-elevated/40 space-y-3">
              <div className="font-semibold text-neutral-900 dark:text-white">
                Buat Pengumuman Gangguan Terjadwal
              </div>

              <div>
                <input
                  type="text"
                  value={annJudul}
                  onChange={(e) => setAnnJudul(e.target.value)}
                  placeholder="Judul pengumuman (misal: Perbaikan Pipa Transmisi Utama Praya)"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none"
                  required
                />
              </div>

              <div>
                <textarea
                  rows={2}
                  value={annIsi}
                  onChange={(e) => setAnnIsi(e.target.value)}
                  placeholder="Rincian wilayah terdampak dan estimasi waktu pemulihan..."
                  className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="rounded-xl bg-emerald-700 py-2 px-4 font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 transition"
              >
                Terbitkan Pengumuman
              </button>
            </form>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-6 flex justify-end border-t border-neutral-100 dark:border-dark-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-dark-border dark:bg-dark-card dark:text-neutral-300 transition"
          >
            Tutup Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
}
