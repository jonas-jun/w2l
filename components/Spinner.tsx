export default function Spinner({ label = "불러오는 중" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center p-10"
    >
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border-2 border-border/60 border-t-muted"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
