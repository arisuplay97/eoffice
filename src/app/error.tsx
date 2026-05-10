"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mb-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="h-8 w-8"
          >
            <path d="M10.3 3.7L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.7a2 2 0 00-3.4 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-ink-900">Terjadi Kesalahan</h1>
        <p className="text-sm text-ink-500 mt-2">
          Sistem mengalami error saat memuat halaman.
          {error.digest && process.env.NODE_ENV !== "production" && (
            <span className="block font-mono text-xs text-ink-400 mt-2">
              ID: {error.digest}
            </span>
          )}
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <button onClick={reset} className="btn-primary">
            Coba Lagi
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
