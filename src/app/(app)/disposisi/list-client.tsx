"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import { IconSearch, IconArrowRight } from "@/components/ui/Icons";
import {
  DISPOSISI_STATUS_LABEL,
  DISPOSISI_STATUS_COLOR,
  INSTRUKSI_LABEL,
  PRIORITAS_COLOR,
} from "@/lib/constants";
import { cn, formatDate, formatRelative } from "@/lib/utils";

type Scope = "inbox" | "outbox" | "all";

export default function DisposisiListClient({
  scope,
  canViewAll,
  items,
  badges,
  initialFilters,
}: {
  scope: Scope;
  canViewAll: boolean;
  items: any[];
  badges: { inbox: number; outbox: number; all: number };
  initialFilters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialFilters.q || "");
  const [status, setStatus] = useState(initialFilters.status || "");

  const tabs: { key: Scope; label: string; count: number }[] = [
    { key: "inbox", label: "Untuk Saya", count: badges.inbox },
    { key: "outbox", label: "Dari Saya", count: badges.outbox },
    ...(canViewAll ? [{ key: "all" as const, label: "Semua Disposisi", count: badges.all }] : []),
  ];

  const go = (newScope: Scope) => {
    const params = new URLSearchParams();
    params.set("scope", newScope);
    router.push(`/disposisi?${params.toString()}`);
  };

  const applyFilter = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    params.set("scope", scope);
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    router.push(`/disposisi?${params.toString()}`);
  };

  return (
    <>
      <PageHeader
        title="Disposisi"
        subtitle="Kelola disposisi yang Anda terima, kirim, dan pantau tindak lanjutnya."
      />

      <div className="flex flex-wrap items-center gap-1.5 mb-4 bg-white ring-1 ring-ink-200 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => go(t.key)}
            className={cn(
              "text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2",
              scope === t.key
                ? "bg-brand-700 text-white shadow-sm"
                : "text-ink-600 hover:bg-ink-100"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  "rounded-full text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center",
                  scope === t.key ? "bg-white/20 text-white" : "bg-red-500 text-white"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <form
        onSubmit={applyFilter}
        className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
      >
        <div className="lg:col-span-2 relative">
          <IconSearch className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Cari perihal / nomor agenda / asal..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.entries(DISPOSISI_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="flex gap-2 lg:col-span-2">
          <button type="submit" className="btn-primary flex-1">
            Filter
          </button>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setStatus("");
              router.push(`/disposisi?scope=${scope}`);
            }}
            className="btn-secondary"
          >
            Reset
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <Empty
          title="Tidak ada disposisi"
          description={
            scope === "inbox"
              ? "Saat ini tidak ada disposisi yang ditujukan kepada Anda."
              : scope === "outbox"
              ? "Anda belum pernah membuat disposisi."
              : "Belum ada disposisi di sistem."
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Disposisi</TH>
              <TH>Surat</TH>
              <TH>{scope === "outbox" ? "Kepada" : "Dari"}</TH>
              <TH>Instruksi</TH>
              <TH>Status</TH>
              <TH>Deadline</TH>
              <TH className="text-right">Aksi</TH>
            </tr>
          </THead>
          <tbody>
            {items.map((d) => {
              const late =
                d.deadline &&
                new Date(d.deadline) < new Date() &&
                !["SELESAI", "DITOLAK"].includes(d.status);
              return (
                <TR key={d.id}>
                  <TD>
                    <p className="text-xs text-ink-500">
                      {formatRelative(d.createdAt)}
                    </p>
                    {d.catatan && (
                      <p className="text-sm text-ink-700 line-clamp-1 max-w-[240px]">
                        {d.catatan}
                      </p>
                    )}
                  </TD>
                  <TD>
                    <Link
                      href={`/surat-masuk/${d.suratMasuk.id}`}
                      className="block max-w-[280px] group"
                    >
                      <p className="font-mono text-[11px] text-ink-500">
                        {d.suratMasuk.nomorAgenda}
                      </p>
                      <p className="text-sm font-medium text-ink-800 line-clamp-1 group-hover:text-brand-700">
                        {d.suratMasuk.perihal}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`chip ${
                            PRIORITAS_COLOR[d.suratMasuk.prioritas as keyof typeof PRIORITAS_COLOR]
                          } text-[10px] py-0`}
                        >
                          {d.suratMasuk.prioritas}
                        </span>
                        <span className="text-xs text-ink-500 truncate">
                          {d.suratMasuk.asalSurat}
                        </span>
                      </div>
                    </Link>
                  </TD>
                  <TD className="text-xs">
                    {scope === "outbox"
                      ? d.toUser?.nama || d.toUnit?.nama || "-"
                      : d.fromUser?.nama}
                    {scope !== "outbox" && d.fromUser?.jabatan && (
                      <p className="text-[11px] text-ink-500">{d.fromUser.jabatan}</p>
                    )}
                  </TD>
                  <TD>
                    <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                      {INSTRUKSI_LABEL[d.instruksi as keyof typeof INSTRUKSI_LABEL]}
                    </span>
                  </TD>
                  <TD>
                    <span
                      className={`chip ${
                        DISPOSISI_STATUS_COLOR[d.status as keyof typeof DISPOSISI_STATUS_COLOR]
                      }`}
                    >
                      {DISPOSISI_STATUS_LABEL[d.status as keyof typeof DISPOSISI_STATUS_LABEL]}
                    </span>
                  </TD>
                  <TD className="text-xs">
                    {d.deadline ? (
                      <span className={late ? "text-red-600 font-medium" : "text-ink-500"}>
                        {formatDate(d.deadline)}
                        {late && <span className="block text-[10px]">Terlambat</span>}
                      </span>
                    ) : (
                      <span className="text-ink-400">-</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/disposisi/${d.id}`}
                      className="text-brand-700 hover:text-brand-800 text-xs font-medium inline-flex items-center gap-1"
                    >
                      Buka <IconArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
