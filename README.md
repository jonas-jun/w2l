# w2l

글쓰기 커뮤니티 MVP. Next.js(App Router) + Supabase.

## 문서

- [docs/PRD.md](docs/PRD.md) — 제품 요구사항 · 로드맵
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 구조 · RLS · 설계 결정
- [docs/DATABASE.md](docs/DATABASE.md) — 테이블 스키마
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — MVP 구현 순서(태스크 단위)
- [CLAUDE.md](CLAUDE.md) — 개발 규칙

## 요구 환경

- Node.js 24 LTS 이상 (개발 환경 검증: v24.19.0, npm 11)

## 시작하기

```bash
npm install
cp .env.example .env.local   # Supabase URL/key 채우기 (T0.2)
npm run dev                  # http://localhost:3000
```

## 스크립트

| 커맨드 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | 타입 체크 |

## 디렉토리

```
app/                  라우트 (App Router)
components/           공용 UI 컴포넌트
lib/                  유틸 · Supabase 클라이언트(lib/supabase/)
supabase/migrations/  SQL 마이그레이션
scripts/              로컬 전용 스크립트
og-parser/            OG 파서 (Python, 별도 배포 — Step 4)
```

## 환경 변수

`.env.example` 참고. `NEXT_PUBLIC_*` 만 클라이언트에 노출되며,
`SUPABASE_SERVICE_ROLE_KEY` · `OG_PARSER_URL` 은 서버 전용이다.
