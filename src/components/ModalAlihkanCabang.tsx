"use client";

import React, { useState } from "react";
import { X, ArrowRightLeft } from "lucide-react";
import { CABANG_LIST } from "@/lib/constants";

interface ModalAlihkanCabangProps {
  aduan: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalAlihkanCabang({
  aduan,
  isOpen,
  onClose,
  onSuccess,
}: ModalAlihkanCabangProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetCabangId, setTargetCabangId] = useState(
    CABANG_LIST.find((c) => c.nama !== aduan?.cabangNama)?.kode || CABANG_LIST[0].kode
  );
  const [alasan, setAlasan] = useState("");

  if (!isOpen || !aduan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/aduan/${aduan.id}/alihkan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCabangId,
          alasan,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal mengalihkan cabang.");
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
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Alihkan Cabang Aduan</h2>
              <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {aduan.id}
              </span>
            </div>
            <p className="text-xs text-slate-500">Cabang Saat Ini: {aduan.cabangNama}</p>
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

        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 leading-relaxed">
          <strong>Perhatian:</strong> Mengalihkan cabang akan secara otomatis menutup tiket lama ini
          sebagai <em>Batal (Dialihkan)</em> dan menerbitkan tiket baru dengan kode cabang tujuan
          terpilih. Referensi silang akan dicatat ke log audit kedua tiket.
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">Cabang Tujuan Baru</label>
            <select
              value={targetCabangId}
              onChange={(e) => setTargetCabangId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 font-semibold focus:border-sky-600 focus:outline-none"
              required
            >
              {CABANG_LIST.filter((c) => c.nama !== aduan.cabangNama).map((c) => (
                <option key={c.kode} value={c.kode}>
                  {c.nama} ({c.wilayah})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Alasan Pengalihan Cabang
            </label>
            <textarea
              rows={3}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: Lokasi pelanggan berada di wilayah perbatasan yang lebih dekat ditangani oleh Cabang Jonggat..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-600 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>{loading ? "Memproses..." : "Konfirmasi Pengalihan"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
