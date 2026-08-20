"use client";

import { useSearchParams } from "next/navigation";

/**
 * 확인 메일 링크가 만료·재사용되면 /auth/callback이 ?error=auth로 돌려보낸다.
 * useSearchParams를 쓰므로 호출하는 쪽에서 Suspense로 감싸야 한다.
 */
export default function AuthErrorNotice() {
  const failed = useSearchParams().get("error") === "auth";
  if (!failed) return null;

  return (
    <p className="max-w-xs text-center text-sm text-red-600">
      인증 링크가 만료되었거나 이미 사용되었습니다. 다시 로그인해주세요.
    </p>
  );
}
