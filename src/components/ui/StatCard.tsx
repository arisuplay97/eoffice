import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "blue" | "emerald" | "amber" | "red" | "indigo" | "slate";
  className?: string;
}) {
  const tones: Record<string, string> = {
    blue: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    indigo: "bg-indigo-50 text-indigo-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className={cn("card card-hover p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {label}
          </p>
          <p className="mt-1.5 text-[26px] font-semibold text-ink-900 tabular-nums">
            {value}
          </p>
          {hint && <p className="text-xs text-ink-500 mt-1">{hint}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              tones[tone]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
