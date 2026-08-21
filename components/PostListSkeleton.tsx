export default function PostListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 border-b border-border/40 py-3"
        >
          <div className="h-4 w-3/4 animate-pulse rounded bg-border/40" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-border/40" />
        </div>
      ))}
    </div>
  );
}
