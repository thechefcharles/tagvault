'use client';

export function Skeleton({
  className = '',
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700 ${className}`}
      {...props}
    />
  );
}

/** Full-width card skeleton for vault list */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <Skeleton className="mb-3 aspect-video w-full rounded-lg" />
      <Skeleton className="mb-2 h-4 w-1/3" />
      <Skeleton className="mb-2 h-5 w-full" />
      <Skeleton className="mb-1 h-4 w-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/** Inline list skeleton (e.g. share import or search) */
export function SkeletonLine({ width = 'full' }: { width?: 'full' | '2/3' | '1/2' }) {
  const w = width === 'full' ? 'w-full' : width === '2/3' ? 'w-2/3' : 'w-1/2';
  return <Skeleton className={`h-4 ${w}`} />;
}
