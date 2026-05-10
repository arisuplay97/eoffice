"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { IconSearch } from "@/components/ui/Icons";

type Unit = { id: string; nama: string };

export default function ArsipFilterClient({
  units,
  initial,
}: {
  units: Unit[];
  initial: {
    q: string;
    jenis: "masuk" | "keluar";
    tahun: string;
    bulan: string;
    unitId: string;
  };
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q);
  const [jenis, setJenis] = useState<"masuk" | "keluar">(initial.jenis);
  const [tahun, setTahun] = useState(initial.tahun);
  const [bulan, setBulan] = useState(initial.bulan);
  const [unitId, setUnitId] = useState(initial.unitId);

  const tahunOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  const bulanOptions = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    params.set("jenis", jenis);
    if (q) params.set("q", q);
    if (tahun) params.set("tahun", tahun);
    if (bulan) params.set("bulan", bulan);
    if (unitId) params.set("unitId", unitId);
    router.push(`/arsip?${params.toString()}`);
  };

  const reset = () => {
    setQ("");
    setTahun("");
    setBulan("");
    setUnitId("");
    router.push(`/arsip?jenis=${jenis}`);
  };

  const setJenisAndGo = (j: "masuk" | "keluar") => {
    setJenis(j);
    const params = new URLSearchParams();
    params.set("jenis", j);
    if (q) params.set("q", q);
    if (tahun) params.set("tahun", tahun);
    if (bulan) params.set("bulan", bulan);
    if (unitId) params.set("unitId", unitId);
    router.push(`/arsip?${params.toString()}`);
  };

  return (
    <div className="mb-5 space-y-3">
      <div className="flex gap-1 rounded-xl bg-white ring-1 ring-ink-200 p-1 w-fit">
        <button
          onClick={() => setJenisAndGo("masuk")}
          className={cn(
            "text-sm font-medium px-4 py-2 rounded-lg transition",
            jenis === "masuk" ? "bg-brand-700 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100"
          )}
        >
          Surat Masuk
        </button>
        <button
          onClick={() => setJenisAndGo("keluar")}
          className={cn(
            "text-sm font-medium px-4 py-2 rounded-lg transition",
            jenis === "keluar" ? "bg-brand-700 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100"
          )}
        >
          Surat Keluar
        </button>
      </div>

      <form
        onSubmit={apply}
        className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div className="lg:col-span-2 relative">
          <IconSearch className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Cari nomor / perihal / asal..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="select" value={tahun} onChange={(e) => setTahun(e.target.value)}>
          <option value="">Semua Tahun</option>
          {tahunOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select className="select" value={bulan} onChange={(e) => setBulan(e.target.value)}>
          <option value="">Semua Bulan</option>
          {bulanOptions.map((b, i) => (
            <option key={i} value={i + 1}>
              {b}
            </option>
          ))}
        </select>
        <select className="select" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Semua Unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nama}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">
            Terapkan
          </button>
          <button type="button" onClick={reset} className="btn-secondary">
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
