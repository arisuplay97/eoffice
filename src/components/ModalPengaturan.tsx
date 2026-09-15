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
  Smartphone,
  UserPlus,
  Phone,
  UserCheck,
  Trash2,
  Search,
} from "lucide-react";

interface ModalPengaturanProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalPengaturan({ isOpen, onClose }: ModalPengaturanProps) {
  const [activeTab, setActiveTab] = useState<"sla" | "users" | "announcements" | "petugas">("sla");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states - PIN & User
  const [resetUserId, setResetUserId] = useState("");
  const [newPin, setNewPin] = useState("");

  // Form states - Announcements
  const [annJudul, setAnnJudul] = useState("");
  const [annIsi, setAnnIsi] = useState("");
  const [annMulai, setAnnMulai] = useState("");
  const [annSelesai, setAnnSelesai] = useState("");

  // Form states - Petugas WhatsApp
  const [petugasNama, setPetugasNama] = useState("");
  const [petugasNoHp, setPetugasNoHp] = useState("");
  const [petugasRole, setPetugasRole] = useState("Teknisi Lapangan");
  const [petugasCabangId, setPetugasCabangId] = useState("");
  const [petugasNotifAduanBaru, setPetugasNotifAduanBaru] = useState(true);
  const [petugasNotifDarurat, setPetugasNotifDarurat] = useState(true);
  const [searchPetugas, setSearchPetugas] = useState("");
  const [filterCabangPetugas, setFilterCabangPetugas] = useState("SEMUA");
  const [isSubmittingPetugas, setIsSubmittingPetugas] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || "Gagal memuat pengaturan.");
      setData(result);
      if (result.branches && result.branches.length > 0 && !petugasCabangId) {
        setPetugasCabangId(result.branches[0].id);
      }
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

  // Petugas Handlers
  const handleCreatePetugas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petugasNama.trim() || !petugasNoHp.trim() || !petugasCabangId) {
      setError("Nama, No WhatsApp, dan Cabang wajib diisi.");
      return;
    }

    setIsSubmittingPetugas(true);
    setError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_petugas",
          nama: petugasNama.trim(),
          noHp: petugasNoHp.trim(),
          role: petugasRole.trim(),
          cabangId: petugasCabangId,
          notifAduanBaru: petugasNotifAduanBaru,
          notifDarurat: petugasNotifDarurat,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) throw new Error(resData.error || "Gagal mendaftarkan petugas.");

      showNotification(`Petugas WhatsApp ${petugasNama} berhasil didaftarkan.`);
      setPetugasNama("");
      setPetugasNoHp("");
      fetchSettings();
    } catch (e: any) {
      setError(e.message || "Gagal mendaftarkan petugas.");
    } finally {
      setIsSubmittingPetugas(false);
    }
  };

  const handleTogglePetugas = async (petugasId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_petugas",
          petugasId,
          aktif: !currentStatus,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) throw new Error(resData.error || "Gagal mengubah status petugas.");
      showNotification(resData.message || "Status petugas WhatsApp diperbarui.");
      fetchSettings();
    } catch (e: any) {
      setError(e.message || "Gagal mengubah status petugas.");
    }
  };

  const handleDeletePetugas = async (petugasId: string, nama: string) => {
    if (!window.confirm(`Hapus akun WhatsApp petugas ${nama}? Nomor ini tidak akan dikenali lagi sebagai petugas oleh bot.`)) {
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_petugas",
          petugasId,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) throw new Error(resData.error || "Gagal menghapus petugas.");
      showNotification(`Petugas ${nama} berhasil dihapus.`);
      fetchSettings();
    } catch (e: any) {
      setError(e.message || "Gagal menghapus petugas.");
    }
  };

  const filteredPetugas = (data?.petugas || []).filter((p: any) => {
    const matchQuery =
      p.nama.toLowerCase().includes(searchPetugas.toLowerCase()) ||
      p.noHp.toLowerCase().includes(searchPetugas.toLowerCase()) ||
      p.role.toLowerCase().includes(searchPetugas.toLowerCase());
    const matchCabang = filterCabangPetugas === "SEMUA" || p.cabangId === filterCabangPetugas;
    return matchQuery && matchCabang;
  });

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
                Konfigurasi akun petugas WhatsApp, parameter SLA, dan akun staf cabang
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
        <div className="mt-5 flex border-b border-neutral-100 dark:border-dark-border gap-2 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("petugas")}
            className={`flex items-center gap-2 pb-3 px-3 transition border-b-2 whitespace-nowrap ${
              activeTab === "petugas"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Petugas WhatsApp</span>
            {data?.petugas && (
              <span className="ml-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[10px] text-emerald-800 dark:text-emerald-300 font-bold">
                {data.petugas.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sla")}
            className={`flex items-center gap-2 pb-3 px-3 transition border-b-2 whitespace-nowrap ${
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
            className={`flex items-center gap-2 pb-3 px-3 transition border-b-2 whitespace-nowrap ${
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
            className={`flex items-center gap-2 pb-3 px-3 transition border-b-2 whitespace-nowrap ${
              activeTab === "announcements"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Pengumuman Gangguan</span>
          </button>
        </div>

        {/* Tab 1: Petugas WhatsApp Management */}
        {activeTab === "petugas" && (
          <div className="mt-5 space-y-4 text-xs">
            {/* Info Banner */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900/50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 flex items-start gap-2.5">
              <UserCheck className="h-4 w-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
              <div className="text-[11px] leading-relaxed">
                Nomor WhatsApp yang terdaftar di sini otomatis dikenali oleh <strong>Bot WhatsApp SIAGA TIARA</strong> sebagai <strong>Petugas Lapangan</strong> (menu disposisi, kirim foto respon & penyelesaian). Nomor yang tidak terdaftar akan otomatis diarahkan ke <strong>Menu Pelanggan</strong> (lapor gangguan, cek tagihan).
              </div>
            </div>

            {/* Registration Form */}
            <form
              onSubmit={handleCreatePetugas}
              className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4 dark:border-dark-border dark:bg-dark-elevated/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-emerald-600" />
                  <span>Daftarkan Akun WhatsApp Petugas Baru</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Nama Lengkap Petugas *
                  </label>
                  <input
                    type="text"
                    value={petugasNama}
                    onChange={(e) => setPetugasNama(e.target.value)}
                    placeholder="Contoh: Hendy Rizkiawan"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Nomor WhatsApp Aktif *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={petugasNoHp}
                      onChange={(e) => setPetugasNoHp(e.target.value)}
                      placeholder="Contoh: 081907941188 / 62819..."
                      className="w-full rounded-xl border border-neutral-200 bg-white pl-8 pr-3 py-2 font-mono text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none focus:border-emerald-600"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Cabang Penugasan *
                  </label>
                  <select
                    value={petugasCabangId}
                    onChange={(e) => setPetugasCabangId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none focus:border-emerald-600"
                    required
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {data?.branches?.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.nama} ({b.kode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Jabatan / Role
                  </label>
                  <input
                    type="text"
                    value={petugasRole}
                    onChange={(e) => setPetugasRole(e.target.value)}
                    placeholder="Contoh: Teknisi Lapangan, Mandor, dll"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Notification Toggles */}
              <div className="flex flex-col sm:flex-row gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={petugasNotifAduanBaru}
                    onChange={(e) => setPetugasNotifAduanBaru(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-neutral-600 dark:text-neutral-400">
                    Kirim notifikasi WA saat ada aduan baru di cabangnya
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={petugasNotifDarurat}
                    onChange={(e) => setPetugasNotifDarurat(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-[11px] text-neutral-600 dark:text-neutral-400">
                    Kirim notifikasi WA aduan darurat / emergency
                  </span>
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingPetugas}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{isSubmittingPetugas ? "Mendaftarkan..." : "Daftarkan Petugas WhatsApp"}</span>
                </button>
              </div>
            </form>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between pt-1">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchPetugas}
                  onChange={(e) => setSearchPetugas(e.target.value)}
                  placeholder="Cari nama, no WA, role..."
                  className="w-full rounded-xl border border-neutral-200 bg-white pl-8 pr-3 py-1.5 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none"
                />
              </div>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">Cabang:</span>
                <select
                  value={filterCabangPetugas}
                  onChange={(e) => setFilterCabangPetugas(e.target.value)}
                  className="rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-card dark:text-neutral-200 focus:outline-none"
                >
                  <option value="SEMUA">Semua Cabang</option>
                  {data?.branches?.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of Registered Petugas */}
            <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100 dark:divide-dark-border rounded-xl border border-neutral-200/80 bg-white dark:border-dark-border dark:bg-dark-card">
              {filteredPetugas.length === 0 ? (
                <div className="p-6 text-center text-neutral-400 text-xs">
                  Tidak ada petugas WhatsApp ditemukan.
                </div>
              ) : (
                filteredPetugas.map((p: any) => (
                  <div key={p.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-2 hover:bg-neutral-50/50 dark:hover:bg-dark-elevated/30 transition">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs">
                        {p.nama.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <span>{p.nama}</span>
                          <span className="rounded bg-neutral-100 px-1.5 py-0.2 text-[9px] text-neutral-600 dark:bg-dark-elevated dark:text-neutral-400">
                            {p.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                            {p.noHp}
                          </span>
                          <span>•</span>
                          <span>{p.cabang?.nama || "Pusat"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePetugas(p.id, p.aktif)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                          p.aktif
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-neutral-100 text-neutral-500 dark:bg-dark-elevated border border-neutral-200 dark:border-neutral-700"
                        }`}
                        title={p.aktif ? "Petugas aktif menerima pesan WA" : "Petugas nonaktif"}
                      >
                        {p.aktif ? "Aktif" : "Nonaktif"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePetugas(p.id, p.nama)}
                        className="rounded-lg p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition"
                        title="Hapus akun WhatsApp petugas"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: SLA Parameters */}
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

        {/* Tab 3: User Account Management */}
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

        {/* Tab 4: Announcements */}
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
