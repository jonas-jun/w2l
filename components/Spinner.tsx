export default function Spinner({ label = "불러오는 중" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center p-10"
    >
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border-2 border-black/15 border-t-black/60 dark:border-white/15 dark:border-t-white/60"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
