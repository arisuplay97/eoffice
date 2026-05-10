"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { IconDroplet, IconShield } from "@/components/ui/Icons";

/**
 * Sanitasi target redirect untuk mencegah open redirect attack.
 * Hanya terima path internal yang dimulai dengan "/" (bukan "//" atau "/\\"),
 * tidak boleh mengandung skema, dan bukan path login/verify landing.
 */
function safeNextPath(raw: string | null): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/")) return fallback;
    if (decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;
    if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return fallback; // scheme
    if (decoded.length > 500) return fallback;
    if (decoded.startsWith("/login")) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Username dan password wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal login");
        setLoading(false);
        return;
      }
      toast.success(`Selamat datang, ${data.data.user.nama}`);
      router.push(next);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Terjadi kesalahan");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative overflow-hidden hidden lg:flex flex-col justify-between p-12 bg-brand-900 text-white">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 400px at 20% 20%, rgba(255,255,255,.12), transparent 60%), radial-gradient(600px 300px at 80% 80%, rgba(91,157,255,.25), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
            <IconDroplet className="h-6 w-6 text-brand-100" />
          </div>
          <div className="leading-tight">
            <p className="text-xs tracking-[0.22em] text-brand-200 uppercase">
              PERUMDAM
            </p>
            <p className="text-lg font-semibold">Tirta Ardhia Rinjani</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight leading-[1.1]">
              E-Office <span className="text-brand-200">TIARA</span>
            </h1>
            <p className="mt-3 text-brand-100/90 max-w-md leading-relaxed">
              Sistem Administrasi Persuratan, Disposisi, Tracking Dokumen, dan
              Arsip Digital untuk PERUMDAM Tirta Ardhia Rinjani, Kabupaten
              Lombok Tengah.
            </p>
          </div>

          <ul className="space-y-2.5 text-sm text-brand-100/90">
            {[
              "Nomor agenda & nomor surat otomatis",
              "Disposisi berjenjang dengan timeline",
              "Tracking dokumen seperti resi pengiriman",
              "QR verifikasi keabsahan dokumen",
              "Arsip digital & export laporan",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-300" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-brand-200/80">
          &copy; {new Date().getFullYear()} PERUMDAM Tirta Ardhia Rinjani ·
          Lombok Tengah
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-ink-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-700 text-white flex items-center justify-center">
              <IconDroplet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">E-Office TIARA</p>
              <p className="text-xs text-ink-500">
                PERUMDAM Tirta Ardhia Rinjani
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-premium ring-1 ring-ink-200 p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-ink-900">
                Masuk ke akun Anda
              </h2>
              <p className="text-sm text-ink-500 mt-1">
                Silakan masuk menggunakan kredensial perusahaan.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  autoFocus
                  className="input"
                  placeholder="mis. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    className="input pr-20"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-brand-700 hover:text-brand-800 px-2 py-1"
                  >
                    {showPass ? "Sembunyikan" : "Lihat"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5 text-[15px]"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>

            {process.env.NODE_ENV !== "production" && (
              <div className="mt-6 p-3.5 rounded-lg bg-brand-50/50 ring-1 ring-brand-200 text-xs text-brand-900 flex gap-2.5">
                <IconShield className="h-4 w-4 shrink-0 mt-0.5 text-brand-700" />
                <div className="leading-relaxed">
                  <p className="font-semibold">Akun default (development only)</p>
                  <p className="mt-0.5">
                    <span className="font-mono bg-white px-1.5 py-0.5 rounded ring-1 ring-brand-200">
                      admin
                    </span>{" "}
                    /{" "}
                    <span className="font-mono bg-white px-1.5 py-0.5 rounded ring-1 ring-brand-200">
                      admin123
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-ink-500 mt-6">
            Butuh bantuan?{" "}
            <Link
              href="/verify"
              className="text-brand-700 hover:underline font-medium"
            >
              Verifikasi Dokumen Publik
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
