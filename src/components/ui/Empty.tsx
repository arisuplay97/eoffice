import { cn } from "@/lib/utils";

export function Empty({
  title = "Belum ada data",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl bg-white ring-1 ring-ink-200/70",
        className
      )}
    >
      <div className="h-14 w-14 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-7 w-7"
        >
          <path d="M3 7l1.8-3.6A2 2 0 016.6 2h10.8a2 2 0 011.8 1.4L21 7" />
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 11h8M8 15h5" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      {description && (
        <p className="text-sm text-ink-500 mt-1 max-w-md">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
