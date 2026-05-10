import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "slate",
}: {
  children: React.ReactNode;
  className?: string;
  tone?:
    | "slate"
    | "blue"
    | "indigo"
    | "amber"
    | "red"
    | "emerald"
    | "purple"
    | "orange"
    | "sky";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    purple: "bg-purple-50 text-purple-700 ring-purple-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <span className={cn("chip", tones[tone] || tones.slate, className)}>
      {children}
    </span>
  );
}

export function StatusBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "chip bg-slate-100 text-slate-700 ring-slate-200",
        className
      )}
    >
      {label}
    </span>
  );
}
