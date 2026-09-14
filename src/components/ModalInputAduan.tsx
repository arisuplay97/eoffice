"use client";

import React, { useState } from "react";
import {
  X,
  PlusCircle,
  AlertCircle,
} from "lucide-react";
import { CABANG_LIST, WILAYAH_LIST, UNIT_LIST } from "@/lib/constants";
import { JenisGangguan, Prioritas, SumberAduan } from "@prisma/client";
import { broadcastAduanBaru } from "@/hooks/useAduanBaru";

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

      // Broadcast to other tabs for instant popup notification
      if (data.aduan) {
        const matched = CABANG_LIST.find((c) => c.kode === cabangId || c.nama === cabangId);
        broadcastAduanBaru({
          id: data.aduan.id,
          namaPelanggan: data.aduan.namaPelanggan,
          noPelanggan: data.aduan.noPelanggan || "-",
          noHp: data.aduan.noHp || "-",
          jenisGangguan: data.aduan.jenisGangguan,
          prioritas: data.aduan.prioritas,
          cabangNama: data.aduan.cabang?.nama || matched?.nama || "-",
          wilayah: data.aduan.wilayah || matched?.wilayah || "-",
          waktuMasuk: data.aduan.waktuMasuk || new Date().toISOString(),
          sumberAduan: data.aduan.sumberAduan || "DASHBOARD",
          keterangan: data.aduan.keterangan || "",
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem saat menyimpan aduan.");
    } finally {
      setLoading(false);
    }
  };

  // Shared input class
  const inputCls = "input-premium w-full rounded-xl border border-neutral-200/60 bg-white px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700/40 dark:bg-neutral-800/40 dark:text-neutral-200 dark:placeholder:text-neutral-600 dark:focus:border-blue-500";

  const selectCls = "input-premium w-full rounded-xl border border-neutral-200/60 bg-white px-3.5 py-2.5 text-sm text-neutral-800 focus:border-blue-500 focus:outline-none dark:border-neutral-700/40 dark:bg-neutral-800/40 dark:text-neutral-200 dark:focus:border-blue-500 appearance-none";

  const labelCls = "mb-1.5 block text-xs font-semibold text-neutral-600 dark:text-neutral-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-neutral-200/40 bg-white p-6 shadow-2xl dark:border-neutral-700/30 dark:bg-neutral-900 my-8 animate-fade-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Input Aduan Baru
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-500">
                Pencatatan gangguan air dari telepon pengaduan, loket, atau laporan teknisi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* Section 1: Identitas Pelanggan */}
          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
              1. Identitas Pelanggan & Lokasi
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Nama Pelanggan / Pelapor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={namaPelanggan}
                  onChange={(e) => setNamaPelanggan(e.target.value)}
                  placeholder="Nama lengkap pelanggan"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>
                  Nomor Pelanggan (ID Sambungan) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={noPelanggan}
                  onChange={(e) => setNoPelanggan(e.target.value)}
                  placeholder="Contoh: 01048291"
                  className={`${inputCls} font-mono`}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>
                  Nomor WhatsApp / HP Aktif <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="Contoh: 08123456789"
                  className={`${inputCls} font-mono`}
                  required
                />
              </div>

              {canSeeAll && (
                <div>
                  <label className={labelCls}>
                    Cabang Bertanggung Jawab <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={cabangId}
                    onChange={(e) => setCabangId(e.target.value)}
                    className={selectCls}
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
                <label className={labelCls}>
                  Detail Alamat Lengkap <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={lokasiDetail}
                  onChange={(e) => setLokasiDetail(e.target.value)}
                  placeholder="Contoh: Jl. Diponegoro No. 45, RT 02/RW 01, Dusun Karang Lebah"
                  className={inputCls}
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Klasifikasi Gangguan */}
          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
              2. Klasifikasi Gangguan & SLA
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Jenis Gangguan Air <span className="text-rose-500">*</span>
                </label>
                <select
                  value={jenisGangguan}
                  onChange={(e) => setJenisGangguan(e.target.value as JenisGangguan)}
                  className={selectCls}
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
                <label className={labelCls}>
                  Prioritas Penanganan (SLA 24 Jam)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { val: Prioritas.RENDAH, label: "Rendah", activeColor: "bg-neutral-700 border-neutral-700 text-white" },
                    { val: Prioritas.SEDANG, label: "Sedang", activeColor: "bg-sky-600 border-sky-600 text-white" },
                    { val: Prioritas.TINGGI, label: "Tinggi", activeColor: "bg-amber-500 border-amber-500 text-white" },
                    { val: Prioritas.DARURAT, label: "Darurat", activeColor: "bg-rose-500 border-rose-500 text-white" },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setPrioritas(p.val)}
                      className={`rounded-lg py-2.5 text-center text-xs font-semibold transition-all border ${
                        prioritas === p.val
                          ? `${p.activeColor} shadow-sm`
                          : "border-neutral-200/60 bg-white text-neutral-600 hover:border-neutral-300 dark:border-neutral-700/40 dark:bg-neutral-800/40 dark:text-neutral-400 dark:hover:border-neutral-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>
                Deskripsi Gangguan / Keterangan Pelapor
              </label>
              <textarea
                rows={3}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Jelaskan secara ringkas keluhan pelanggan..."
                className={inputCls}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-200/60 bg-white px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/40 dark:bg-neutral-800/40 dark:text-neutral-400 dark:hover:bg-neutral-700/40 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 px-6 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {loading ? "Menyimpan..." : "Simpan Aduan Baru"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
