import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div>
        <p className="font-medium">찾을 수 없는 페이지입니다.</p>
        <p className="mt-1 text-sm text-muted">
          삭제되었거나 주소가 잘못되었을 수 있습니다.
        </p>
      </div>
      <Link href="/" className="rounded bg-foreground px-4 py-2 text-sm text-background">
        홈으로
      </Link>
    </main>
  );
}
