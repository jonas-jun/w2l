import { createBrowserClient } from "@supabase/ssr";
import { requiredEnv } from "@/lib/supabase/env";

/** 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트. anon key만 사용한다. */
export function createClient() {
  return createBrowserClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
