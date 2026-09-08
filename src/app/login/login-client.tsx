"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Lock, KeyRound, AlertCircle } from "lucide-react";
import { CABANG_LIST } from "@/lib/constants";

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [selectedCabang, setSelectedCabang] = useState("admin");
  const [pinOrPass, setPinOrPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedCabang,
          pin: pinOrPass.trim(),
          password: pinOrPass.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Autentikasi gagal. Periksa kembali PIN atau password Anda.");
      }

      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Terjadi kendala saat menghubungkan ke server.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (username: string, pin: string) => {
    setSelectedCabang(username);
    setPinOrPass(pin);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#133ca0] px-4 py-12 text-slate-100 antialiased selection:bg-blue-300 selection:text-blue-900">
      {/* Main Container */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md">
        {/* Top Logo and Titles (Matching Reference Image 5) */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2.5 shadow-xl shadow-blue-950/30 ring-1 ring-white/40">
            <img
              src="/logo.png"
              alt="Logo PERUMDAM Tirta Ardhia Rinjani"
              className="h-full w-auto object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            SIAGA TIARA
          </h1>
          <p className="mt-1 text-xs text-blue-100/90 font-medium">
            Perumdam Tirta Ardhia Rinjani Kabupaten Lombok Tengah
          </p>
        </div>

        {/* Clean White Card (Matching Reference Image 5) */}
        <div className="rounded-2xl border border-white/20 bg-white p-6 sm:p-7 shadow-2xl text-slate-900">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">
              Masuk ke Sistem
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Masukkan kredensial akun Anda
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Account Selector (No manual username typing as requested!) */}
            <div>
              <label className="mb-1.5 block font-semibold text-slate-700">
                Pilih Akun Petugas / Cabang
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <select
                  value={selectedCabang}
                  onChange={(e) => setSelectedCabang(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 py-2.5 text-xs font-medium text-slate-800 transition hover:bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="admin">Admin Pusat (Semua 12 Cabang)</option>
                  <option value="direksi">Direksi Operasional</option>
                  <optgroup label="Cabang Pelayanan (12 Unit)">
                    {CABANG_LIST.map((c) => (
                      <option key={c.kode} value={`cabang_${c.kode.toLowerCase()}`}>
                        {c.nama.startsWith("Cabang ") ? c.nama : `Cabang ${c.nama}`} ({c.wilayah})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Password / PIN */}
            <div>
              <label className="mb-1.5 block font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={pinOrPass}
                  onChange={(e) => setPinOrPass(e.target.value)}
                  placeholder="Masukkan password atau PIN"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 transition hover:bg-slate-50 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>
            </div>

            {/* Submit Button (Matching Image 5) */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-[#0d1527] hover:bg-[#1e293b] text-white py-2.5 text-xs font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? "Memvalidasi Akses..." : "Masuk"}
            </button>
          </form>

          {/* Quick Demo Info Box (Matching Image 5) */}
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600">
            <div className="font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Akun Demo:</span>
              <span className="text-[10px] text-slate-400 font-mono">PIN: 123456</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => handleQuickSelect("admin", "123456")}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:border-blue-500 hover:text-blue-700 transition"
              >
                <KeyRound className="h-2.5 w-2.5 text-slate-400" />
                <span>Admin Pusat</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect("cabang_pry", "123456")}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:border-blue-500 hover:text-blue-700 transition"
              >
                <KeyRound className="h-2.5 w-2.5 text-slate-400" />
                <span>Cabang Praya</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect("direksi", "123456")}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:border-blue-500 hover:text-blue-700 transition"
              >
                <KeyRound className="h-2.5 w-2.5 text-slate-400" />
                <span>Direksi</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note (Matching Image 5) */}
        <div className="mt-8 text-center text-xs text-blue-100/70 font-medium">
          &copy; 2026 Tirta Ardhia Rinjani
        </div>
      </div>
    </div>
  );
}
