import { createBrowserClient } from '@supabase/ssr'

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`환경 변수 ${name} 가 비어 있다. .env.local 을 확인하라.`)
  return value
}

/** 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트. anon key만 사용한다. */
export function createClient() {
  return createBrowserClient(
    required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  )
}
