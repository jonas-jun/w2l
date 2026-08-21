import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 확인 메일의 링크를 처리한다.
 * Supabase가 메일 링크를 검증한 뒤 이 경로로 `?code=...`를 붙여 되돌려 보내고,
 * 여기서 code를 세션으로 교환한다 (@supabase/ssr은 PKCE 플로우가 기본이다).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // 열린 리다이렉트가 되지 않도록 같은 사이트 내 경로만 허용한다.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // 프로필이 없으면 proxy가 온보딩으로 보낸다.
  return NextResponse.redirect(`${origin}${next}`);
}
