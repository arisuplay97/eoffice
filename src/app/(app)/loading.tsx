export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 w-64 bg-ink-200 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white ring-1 ring-ink-200" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-white ring-1 ring-ink-200" />
    </div>
  );
}
