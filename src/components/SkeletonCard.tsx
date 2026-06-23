/** Shimmer skeleton for a single repo card row */
export function SkeletonCard() {
  return (
    <div
      aria-label="Loading placeholder"
      className="flex items-center gap-3 px-3 border-b border-[var(--border)]"
      style={{ height: 40 }}
      aria-hidden="true"
    >
      <div className="skeleton w-3.5 h-3.5 rounded-sm flex-shrink-0" />
      <div className="skeleton w-1.5 h-1.5 rounded-full flex-shrink-0" />
      <div className="skeleton h-3 w-24 rounded flex-shrink-0" />
      <div className="skeleton h-3 flex-1 rounded" />
      <div className="skeleton h-3 w-16 rounded hidden sm:block" />
    </div>
  );
}
