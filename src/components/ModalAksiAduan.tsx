"use client";

import React, { useState } from "react";
import { X, CheckCircle, Camera } from "lucide-react";
import { STATUS_LABELS, PRIORITAS_LABELS, UNIT_LIST } from "@/lib/constants";
import { StatusAduan, Prioritas, TipeDokumentasi } from "@prisma/client";

interface ModalAksiAduanProps {
  aduan: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalAksiAduan({
  aduan,
  isOpen,
  onClose,
  onSuccess,
}: ModalAksiAduanProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusAduan>(aduan?.status || StatusAduan.PROSES);
  const [prioritas, setPrioritas] = useState<Prioritas>(aduan?.prioritas || Prioritas.SEDANG);
  const [unit, setUnit] = useState(aduan?.unit || "Cabang");
  const [catatan, setCatatan] = useState(aduan?.catatan !== "-" ? aduan?.catatan || "" : "");
  const [keteranganAksi, setKeteranganAksi] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [fotoCaption, setFotoCaption] = useState("");
  const [tipeFoto, setTipeFoto] = useState<TipeDokumentasi>(TipeDokumentasi.FOTO_PROSES);

  if (!isOpen || !aduan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/aduan/${aduan.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          prioritas,
          unit,
          catatan,
          keteranganAksi: keteranganAksi || `Status diperbarui menjadi ${STATUS_LABELS[status]}`,
          fotoUrl: fotoUrl.trim() || undefined,
          fotoCaption: fotoCaption.trim() || undefined,
          tipeFoto: status === StatusAduan.SELESAI ? TipeDokumentasi.FOTO_SELESAI : tipeFoto,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal memperbarui status.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Tindak Lanjut Aduan</h2>
              <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {aduan.id}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Pelanggan: {aduan.namaPelanggan} ({aduan.cabangNama})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Perbarui Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusAduan)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-800 focus:border-sky-600 focus:outline-none"
              >
                <option value={StatusAduan.DIRESPONS}>Direspons</option>
                <option value={StatusAduan.PROSES}>Proses</option>
                <option value={StatusAduan.DALAM_PENGERJAAN}>Dalam Pengerjaan</option>
                <option value={StatusAduan.KENDALA}>Kendala Lapangan</option>
                <option value={StatusAduan.DITUNDA}>Ditunda</option>
                <option value={StatusAduan.SELESAI}>Selesai</option>
                <option value={StatusAduan.BATAL}>Batal</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Prioritas</label>
              <select
                value={prioritas}
                onChange={(e) => setPrioritas(e.target.value as Prioritas)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-600 focus:outline-none"
              >
                <option value={Prioritas.RENDAH}>Rendah</option>
                <option value={Prioritas.SEDANG}>Sedang</option>
                <option value={Prioritas.TINGGI}>Tinggi</option>
                <option value={Prioritas.DARURAT}>Darurat</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Unit Penanggung Jawab</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-600 focus:outline-none"
            >
              {UNIT_LIST.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Keterangan Tindak Lanjut / Log Aktivitas
            </label>
            <input
              type="text"
              value={keteranganAksi}
              onChange={(e) => setKeteranganAksi(e.target.value)}
              placeholder="Contoh: Petugas telah mengganti kran meteran pipa diameter 0.5 inch"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Catatan Internal</label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan teknis khusus internal cabang..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-600 focus:outline-none"
            />
          </div>

          {/* Bagian Bukti Foto Dokumentasi */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Camera className="h-4 w-4 text-slate-500" />
              <span>Dokumentasi Foto Pengerjaan</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-slate-600">Tipe Foto</label>
                <select
                  value={status === StatusAduan.SELESAI ? TipeDokumentasi.FOTO_SELESAI : tipeFoto}
                  onChange={(e) => setTipeFoto(e.target.value as TipeDokumentasi)}
                  disabled={status === StatusAduan.SELESAI}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-sky-600 focus:outline-none disabled:bg-slate-100"
                >
                  <option value={TipeDokumentasi.FOTO_PROSES}>Foto Saat Pengerjaan</option>
                  <option value={TipeDokumentasi.FOTO_SELESAI}>Foto Hasil Selesai</option>
                  <option value={TipeDokumentasi.FOTO_RESPONS}>Foto Cek Awal / Respons</option>
                  <option value={TipeDokumentasi.FOTO_SEBELUM}>Foto Kondisi Sebelum</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-slate-600">Keterangan Foto (Caption)</label>
                <input
                  type="text"
                  value={fotoCaption}
                  onChange={(e) => setFotoCaption(e.target.value)}
                  placeholder="Contoh: Air mengalir lancar setelah diganti"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-slate-600">URL Foto / Link Cloud Drive</label>
              <input
                type="url"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... atau link foto bukti"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              <span>{loading ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
