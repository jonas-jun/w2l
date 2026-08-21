"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // push 직후 refresh()를 더 부르면 진행 중인 전환과 경합해 화면이 멈출 수 있다.
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20"
    >
      로그아웃
    </button>
  );
}
