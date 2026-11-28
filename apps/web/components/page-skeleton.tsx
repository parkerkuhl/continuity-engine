/** Shown while a world or campaign screen loads (UX review #31): a title bar and three grey cards. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex animate-pulse flex-col gap-6">
      <div className="h-10 w-64 max-w-full rounded-lg bg-sunken" />
      <div className="h-11 w-full rounded-lg bg-sunken" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-sunken" />
        ))}
      </div>
    </div>
  );
}
