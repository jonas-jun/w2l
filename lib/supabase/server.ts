import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`환경 변수 ${name} 가 비어 있다. .env.local 을 확인하라.`)
  return value
}

/**
 * 서버(서버 컴포넌트 · Route Handler · Server Action)용 Supabase 클라이언트.
 * 요청마다 새로 만든다 — 요청 간에 공유하면 세션이 섞인다.
 * anon key + 쿠키 세션으로 동작하므로 RLS가 그대로 적용된다 (service_role 사용 금지).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다(Next.js 제약).
            // 토큰 갱신 쓰기는 middleware가 담당한다 — T1.2에서 추가한다.
          }
        },
      },
    },
  )
}
