"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconSearch, IconTracking } from "@/components/ui/Icons";

export default function TrackingSearchClient({
  defaultQuery,
}: {
  defaultQuery: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);

  useEffect(() => {
    setQ(defaultQuery);
    if (defaultQuery) {
      router.replace(`/tracking/${encodeURIComponent(defaultQuery)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultQuery]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/tracking/${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-12 w-12 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
            <IconTracking className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">
              Cari Posisi Dokumen
            </h3>
            <p className="text-xs text-ink-500">
              Masukkan kode verifikasi, nomor agenda, atau nomor surat.
            </p>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="relative">
            <IconSearch className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-10 pr-28 py-3 text-base"
              placeholder="mis. TIARA-20260510-A1B2C3"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary absolute right-1.5 top-1/2 -translate-y-1/2"
            >
              Telusuri
            </button>
          </div>
        </form>

        <div className="mt-6 grid sm:grid-cols-3 gap-3 text-xs text-ink-600">
          <TipCard title="Kode Verifikasi" example="TIARA-20260510-A1B2C3" />
          <TipCard title="Nomor Agenda" example="AGD/2026/05/0001" />
          <TipCard title="Nomor Surat" example="TAR/SEK/2026/05/0001" />
        </div>
      </div>
    </div>
  );
}

function TipCard({ title, example }: { title: string; example: string }) {
  return (
    <div className="rounded-xl ring-1 ring-ink-200 p-3">
      <p className="font-medium text-ink-700">{title}</p>
      <p className="font-mono text-[11px] text-ink-500 mt-1 break-all">{example}</p>
    </div>
  );
}
