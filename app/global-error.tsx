"use client";

import { useEffect } from "react";

// 루트 레이아웃에서 난 에러를 받는 최후의 경계다.
// 레이아웃을 대체하므로 html/body를 직접 그려야 한다.
export default function GlobalError({
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
    <html lang="ko">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <p>문제가 발생했습니다.</p>
        <button onClick={reset} style={{ textDecoration: "underline" }}>
          다시 시도
        </button>
      </body>
    </html>
  );
}
