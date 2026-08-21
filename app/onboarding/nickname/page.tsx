"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NICKNAME_PATTERN = /^[a-zA-Z0-9가-힣]{2,12}$/;

export default function NicknameOnboardingPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!NICKNAME_PATTERN.test(nickname)) {
      setError("닉네임은 한글/영문/숫자 2~12자로 입력해주세요.");
      return;
    }

    setSubmitting(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, nickname });

    setSubmitting(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("이미 사용 중인 닉네임입니다.");
      } else {
        setError("닉네임 설정에 실패했습니다. 다시 시도해주세요.");
      }
      return;
    }

    // push만으로 새 프로필이 반영된 홈을 받는다 (동적 렌더). refresh()를 더 부르면
    // 진행 중인 전환과 경합해 화면이 멈출 수 있다.
    router.push("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">닉네임을 설정해주세요</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 (2~12자)"
          maxLength={12}
          required
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          완료
        </button>
      </form>
    </main>
  );
}
