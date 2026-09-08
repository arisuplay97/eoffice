"use client";

import React, { useState } from "react";
import {
  X,
  PlusCircle,
  Building2,
  User,
  Phone,
  MapPin,
  AlertCircle,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { CABANG_LIST, WILAYAH_LIST, UNIT_LIST } from "@/lib/constants";
import { JenisGangguan, Prioritas, SumberAduan } from "@prisma/client";

interface ModalInputAduanProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userCabangId?: string | null;
  canSeeAll?: boolean;
}

export default function ModalInputAduan({
  isOpen,
  onClose,
  onSuccess,
  userCabangId,
  canSeeAll = true,
}: ModalInputAduanProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cabangId, setCabangId] = useState(userCabangId || (CABANG_LIST[0] ? "PRY" : ""));
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [noPelanggan, setNoPelanggan] = useState("");
  const [noHp, setNoHp] = useState("");
  const [wilayah, setWilayah] = useState(WILAYAH_LIST[0]);
  const [desa, setDesa] = useState("");
  const [jenisGangguan, setJenisGangguan] = useState<JenisGangguan>(JenisGangguan.AIR_MATI);
  const [prioritas, setPrioritas] = useState<Prioritas>(Prioritas.SEDANG);
  const [unit, setUnit] = useState(UNIT_LIST[0]);
  const [sumberAduan, setSumberAduan] = useState<SumberAduan>(SumberAduan.DASHBOARD);
  const [keterangan, setKeterangan] = useState("");
  const [lokasiDetail, setLokasiDetail] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const matched = CABANG_LIST.find((c) => c.kode === cabangId || c.nama === cabangId);
      const targetCabang = matched?.kode || cabangId;

      const res = await fetch("/api/aduan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cabangId: targetCabang,
          namaPelanggan,
          noPelanggan,
          noHp,
          lokasiDetail,
          desa: lokasiDetail,
          wilayah: matched?.wilayah || "Lombok Tengah",
          jenisGangguan,
          prioritas,
          unit,
          sumberAduan,
          keterangan,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal mencatat aduan.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem saat menyimpan aduan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-2xl dark:border-dark-border dark:bg-dark-card my-8 transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-dark-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-dark-elevated text-neutral-900 dark:text-white">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Input Aduan Baru
              </h2>
              <p className="text-xs text-neutral-500 dark:text-dark-muted">
                Pencatatan gangguan air dari telepon pengaduan, loket, atau laporan teknisi
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

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5 text-xs">
          {/* Section 1: Identitas Pelanggan */}
          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              1. Identitas Pelanggan & Lokasi
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
                  Nama Pelanggan / Pelapor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={namaPelanggan}
                  onChange={(e) => setNamaPelanggan(e.target.value)}
                  placeholder="Nama lengkap pelanggan"
                  className="w-full rounded-xl border border-neutral-200/90 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:border-emerald-600 focus:bg-white focus:outline-none dark:focus:bg-dark-card"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
                  Nomor Pelanggan (ID Sambungan) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={noPelanggan}
                  onChange={(e) => setNoPelanggan(e.target.value)}
                  placeholder="Contoh: 01048291"
                  className="w-full rounded-xl border border-neutral-200/90 bg-neutral-50/50 px-3 py-2 font-mono text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:border-emerald-600 focus:bg-white focus:outline-none dark:focus:bg-dark-card"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
                  Nomor WhatsApp / HP Aktif <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="Contoh: 08123456789"
                  className="w-full rounded-xl border border-neutral-200/90 bg-neutral-50/50 px-3 py-2 font-mono text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:border-emerald-600 focus:bg-white focus:outline-none dark:focus:bg-dark-card"
                  required
                />
              </div>

              {canSeeAll && (
                <div>
                  <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
                    Cabang Bertanggung Jawab <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={cabangId}
                    onChange={(e) => setCabangId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200/90 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:border-emerald-600 focus:outline-none"
                  >
                    {CABANG_LIST.map((c) => (
                      <option key={c.kode} value={c.kode}>
                        {c.nama.startsWith("Cabang ") ? c.nama : `Cabang ${c.nama}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
                  Detail Alamat Lengkap (Nama Jalan, Dusun, RT/RW, Patokan Lokasi) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={lokasiDetail}
                  onChange={(e) => setLokasiDetail(e.target.value)}
                  placeholder="Contoh: Jl. Diponegoro No. 45, RT 02/RW 01, Dusun Karang Lebah, Patokan Depan Masjid Nurul Huda"
                  className="w-full rounded-xl border border-neutral-200/90 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:border-emerald-600 focus:bg-white focus:outline-none dark:focus:bg-dark-card"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Klasifikasi Gangguan & Prioritas */}
          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              2. Klasifikasi Gangguan & SLA
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
                  Jenis Gangguan Air <span className="text-rose-500">*</span>
                </label>
                <select
                  value={jenisGangguan}
                  onChange={(e) => setJenisGangguan(e.target.value as JenisGangguan)}
                  className="w-full rounded-xl border border-neutral-200/90 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:border-emerald-600 focus:outline-none"
                >
                  <option value={JenisGangguan.AIR_MATI}>Air Mati / Tidak Mengalir</option>
                  <option value={JenisGangguan.PIPA_BOCOR}>Pipa Bocor (Jaringan/Dinas)</option>
                  <option value={JenisGangguan.TEKANAN_RENDAH}>Tekanan Air Rendah / Kecil</option>
                  <option value={JenisGangguan.AIR_KERUH}>Kualitas Air Keruh / Berbau</option>
                  <option value={JenisGangguan.METER_BERMASALAH}>Water Meter Rusak / Bocor</option>
                  <option value={JenisGangguan.TAGIHAN}>Keluhan Tagihan / Pembacaan Meter</option>
                  <option value={JenisGangguan.SAMBUNGAN_BARU}>Permohonan Sambungan Baru</option>
                  <option value={JenisGangguan.LAINNYA}>Gangguan Teknis Lainnya</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
                  Prioritas Penanganan (SLA 24 Jam)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { val: Prioritas.RENDAH, label: "Rendah", color: "hover:border-neutral-400" },
                    { val: Prioritas.SEDANG, label: "Sedang", color: "hover:border-sky-500" },
                    { val: Prioritas.TINGGI, label: "Tinggi", color: "hover:border-amber-500" },
                    { val: Prioritas.DARURAT, label: "Darurat", color: "hover:border-rose-500" },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setPrioritas(p.val)}
                      className={`rounded-lg py-2 text-center text-[11px] font-semibold transition border ${
                        prioritas === p.val
                          ? p.val === Prioritas.DARURAT
                            ? "border-rose-500 bg-rose-500 text-white shadow-sm"
                            : p.val === Prioritas.TINGGI
                            ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                            : p.val === Prioritas.SEDANG
                            ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                            : "border-neutral-700 bg-neutral-700 text-white shadow-sm"
                          : `border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-400 ${p.color}`
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
                Deskripsi Gangguan / Keterangan Pelapor
              </label>
              <textarea
                rows={3}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Jelaskan secara ringkas keluhan pelanggan (misal: pipa dinas depan pagar bocor sembur deras)..."
                className="w-full rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-3 text-xs text-neutral-800 dark:border-dark-border dark:bg-dark-elevated dark:text-neutral-200 focus:border-emerald-600 focus:bg-white focus:outline-none dark:focus:bg-dark-card"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-dark-border dark:bg-dark-card dark:text-neutral-400 dark:hover:bg-dark-hover transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 px-5 py-2 text-xs font-semibold shadow-sm border border-neutral-900 dark:border-white active:scale-[0.98] disabled:opacity-50 transition"
            >
              <span>{loading ? "Menyimpan Data..." : "Simpan Aduan Baru"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
