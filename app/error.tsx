"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div>
        <p className="font-medium">문제가 발생했습니다.</p>
        <p className="mt-1 text-sm text-muted">
          잠시 후 다시 시도해주세요.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded bg-foreground px-4 py-2 text-sm text-background"
      >
        다시 시도
      </button>
    </main>
  );
}
