"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Lock, AlertCircle } from "lucide-react";
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

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#090b0e] px-4 py-12 text-slate-100 antialiased selection:bg-sky-500/30 selection:text-sky-200">
      {/* Subtle Background Radial Glow (Restored from previous design) */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[750px] rounded-full bg-gradient-to-tr from-sky-600/10 via-cyan-500/10 to-indigo-600/5 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-64 w-full max-w-4xl bg-gradient-to-t from-sky-950/20 to-transparent blur-3xl" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md">
        {/* Top Logo and Titles */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2.5 shadow-2xl shadow-black/50 ring-1 ring-white/20">
            <img
              src="/logo.png"
              alt="Logo PERUMDAM Tirta Ardhia Rinjani"
              className="h-full w-auto object-contain"
            />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            SIAGA TIARA
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Perumdam Tirta Ardhia Rinjani Kabupaten Lombok Tengah
          </p>
        </div>

        {/* Clean Login Card */}
        <div className="rounded-2xl border border-white/20 bg-white p-6 sm:p-7 shadow-2xl shadow-black/60 text-slate-900">
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
            {/* Account Selector */}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-[#0d1527] hover:bg-[#1e293b] text-white py-2.5 text-xs font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? "Memvalidasi Akses..." : "Masuk"}
            </button>
          </form>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-xs text-slate-500 font-medium">
          &copy; 2026 PERUMDAM Tirta Ardhia Rinjani
        </div>
      </div>
    </div>
  );
}
