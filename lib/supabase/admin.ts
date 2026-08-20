import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role 클라이언트 — RLS를 우회하므로 **서버에서만** 쓴다.
 * Route Handler·Server Component 밖에서 import하지 말 것.
 * `SUPABASE_SERVICE_ROLE_KEY`는 `NEXT_PUBLIC_` 접두사가 없어 클라이언트 번들에
 * 포함되지 않으므로, 실수로 클라이언트에서 부르면 아래에서 에러가 난다.
 *
 * 현재 용도는 link_previews upsert 하나뿐이다 (ARCHITECTURE.md §3 — 쓰기 정책이
 * 없는 테이블이라 서버에서만 갱신한다).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요하다.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
