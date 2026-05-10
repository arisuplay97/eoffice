"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { IconCheck, IconWarning, IconX } from "./Icons";

type ToastType = "success" | "error" | "info";
type Toast = { id: string; message: string; type: ToastType };

type Ctx = {
  push: (msg: string, type?: ToastType) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value: Ctx = {
    push,
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-fadeIn pointer-events-auto flex items-start gap-2.5 rounded-xl px-3.5 py-3 shadow-premium ring-1 text-sm min-w-[280px] max-w-[380px] bg-white",
              t.type === "success" && "ring-emerald-200",
              t.type === "error" && "ring-red-200",
              t.type === "info" && "ring-ink-200"
            )}
          >
            <div
              className={cn(
                "h-6 w-6 flex items-center justify-center rounded-full shrink-0",
                t.type === "success" && "bg-emerald-50 text-emerald-600",
                t.type === "error" && "bg-red-50 text-red-600",
                t.type === "info" && "bg-brand-50 text-brand-700"
              )}
            >
              {t.type === "success" ? (
                <IconCheck className="h-4 w-4" />
              ) : t.type === "error" ? (
                <IconWarning className="h-4 w-4" />
              ) : (
                <IconCheck className="h-4 w-4" />
              )}
            </div>
            <p className="text-ink-800 leading-snug flex-1">{t.message}</p>
            <button
              className="text-ink-400 hover:text-ink-700"
              onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
              aria-label="Tutup"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
