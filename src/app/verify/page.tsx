import Link from "next/link";
import VerifySearchClient from "./search-client";
import { IconDroplet, IconShield } from "@/components/ui/Icons";

export const metadata = {
  title: "Verifikasi Dokumen - E-Office TIARA",
};

export default function VerifyLandingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-14">
      <div className="flex items-center gap-3 justify-center mb-8">
        <div className="h-12 w-12 rounded-2xl bg-brand-700 text-white flex items-center justify-center shadow-sm">
          <IconDroplet className="h-6 w-6" />
        </div>
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink-500">
            PERUMDAM
          </p>
          <p className="text-base font-semibold text-ink-900 leading-tight">
            Tirta Ardhia Rinjani
          </p>
        </div>
      </div>

      <div className="card p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 mx-auto flex items-center justify-center mb-4">
          <IconShield className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold text-ink-900">
          Verifikasi Dokumen
        </h1>
        <p className="text-sm text-ink-500 mt-1.5 max-w-md mx-auto">
          Masukkan kode verifikasi untuk memastikan keaslian dokumen yang
          diterbitkan oleh E-Office TIARA.
        </p>
        <div className="mt-6">
          <VerifySearchClient />
        </div>
      </div>

      <p className="text-center text-xs text-ink-500 mt-6">
        <Link href="/login" className="text-brand-700 font-medium hover:underline">
          Masuk ke E-Office TIARA →
        </Link>
      </p>
    </div>
  );
}
