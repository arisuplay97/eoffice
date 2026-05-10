"use client";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  judul: string;
  keterangan?: string | null;
  waktu: Date | string;
  oleh?: string | null;
  unit?: string | null;
  event?: string;
  terlambat?: boolean;
};

export function Timeline({
  items,
  current,
  orientation = "vertical",
}: {
  items: TimelineItem[];
  current?: number; // index terakhir (pulsing)
  orientation?: "vertical" | "horizontal";
}) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-ink-500 italic">Belum ada aktivitas tracking.</div>
    );
  }

  const lastIndex = current ?? items.length - 1;

  if (orientation === "horizontal") {
    return (
      <div className="overflow-x-auto pb-2">
        <div className="relative flex items-start gap-0 min-w-max px-2">
          {items.map((it, idx) => {
            const reached = idx <= lastIndex;
            const isLast = idx === lastIndex;
            const tone =
              isLast && it.terlambat
                ? "bg-red-500 ring-red-300"
                : reached
                ? "bg-brand-600 ring-brand-200"
                : "bg-ink-200 ring-ink-100";
            return (
              <div key={it.id} className="flex items-start gap-0 min-w-[220px] relative">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded-full ring-4 relative z-10",
                      tone,
                      isLast && !it.terlambat && reached && "animate-pulseDot"
                    )}
                  />
                  {idx < items.length - 1 && (
                    <span className="sr-only">line</span>
                  )}
                </div>
                {idx < items.length - 1 && (
                  <div
                    className={cn(
                      "absolute top-[6px] left-3 right-0 h-0.5",
                      idx < lastIndex ? "bg-brand-500" : "bg-ink-200"
                    )}
                    style={{ width: "calc(100% - 0.75rem)" }}
                  />
                )}
                <div className="ml-3 pr-6 pb-4">
                  <p className="text-xs text-ink-500">{formatDateTime(it.waktu)}</p>
                  <p
                    className={cn(
                      "text-sm font-medium mt-0.5",
                      reached ? "text-ink-800" : "text-ink-400"
                    )}
                  >
                    {it.judul}
                  </p>
                  {it.oleh && (
                    <p className="text-xs text-ink-500">{it.oleh}{it.unit ? ` · ${it.unit}` : ""}</p>
                  )}
                  {it.keterangan && (
                    <p className="text-xs text-ink-500 mt-1">{it.keterangan}</p>
                  )}
                  {isLast && it.terlambat && (
                    <span className="inline-flex items-center gap-1 mt-1 chip bg-red-50 text-red-700 ring-red-200">
                      Terlambat
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vertical (default)
  return (
    <ol className="relative">
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-ink-200" />
      <div
        className="absolute left-[11px] top-2 w-0.5 bg-brand-500 transition-all duration-700"
        style={{
          height: `calc(${(Math.max(lastIndex, 0) / Math.max(items.length - 1, 1)) * 100}% - 8px)`,
        }}
      />
      {items.map((it, idx) => {
        const reached = idx <= lastIndex;
        const isLast = idx === lastIndex;
        const late = isLast && it.terlambat;
        return (
          <li key={it.id} className="relative pl-9 pb-6 last:pb-0">
            <span
              className={cn(
                "absolute left-0 top-1.5 h-6 w-6 rounded-full flex items-center justify-center ring-4",
                late
                  ? "bg-red-500 text-white ring-red-100"
                  : reached
                  ? "bg-brand-600 text-white ring-brand-100"
                  : "bg-white text-ink-400 ring-ink-100 border border-ink-200",
                isLast && reached && !late && "animate-pulseDot"
              )}
            >
              {reached ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "text-sm font-semibold",
                  reached ? "text-ink-900" : "text-ink-400"
                )}
              >
                {it.judul}
              </p>
              {late && (
                <span className="chip bg-red-50 text-red-700 ring-red-200">
                  Terlambat
                </span>
              )}
            </div>
            <p className="text-xs text-ink-500 mt-0.5">
              {formatDateTime(it.waktu)}
              {it.oleh ? ` · ${it.oleh}` : ""}
              {it.unit ? ` · ${it.unit}` : ""}
            </p>
            {it.keterangan && (
              <p className="text-sm text-ink-600 mt-1.5 leading-relaxed">
                {it.keterangan}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
