# Claude Code Development Rules

## 1. Core Principles
* **문서 우선:** 코드를 작성하기 전에 `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`를 반드시 확인한다.
* **작은 단위 구현:** 한 번에 전체를 구현하지 않고 PRD 기준의 독립적인 Task로 분리한다. (예: "게시판 전체 구현" ❌ -> "posts RLS 생성 -> 목록 UI 구현" ✅)
* **최소 변경:** 기존 기능을 깨뜨리지 않는 범위에서 가장 작은 변경을 한다.

## 2. Strict Constraints
* **Do not** modify database schema without migration.
* **Do not** bypass Row Level Security (RLS).
* **Do not** expose service_role_key to client.
* **Do not** add dependencies without justification.
* **Do not** implement PRD 로드맵 Phase 2~4 features (A vs B 대결/투표, 소셜 로그인, 타임어택 리그, AI 아카이빙) during MVP. (아래 §4의 개발 Step과 혼동하지 말 것 — "Phase"는 PRD의 제품 로드맵을 가리킨다.)

## 3. Workflow
1. **Understand:** 관련 문서를 읽고 현재 구조 분석
2. **Plan:** 필요한 DB/API/UI 변경사항 및 구현 계획 작성
   * 현재 issue 기반으로 작업을 이해하고 계획을 세울 때는 `working/issue-{issue번호}_{workname}.md` 형식으로 계획서 파일을 작성한다. (예: `working/issue-10_accounts.md`) `working/`은 `.gitignore` 대상이라 커밋되지 않는다.
3. **Implement:** 작은 단위로 코드 작성
4. **Test:** TypeScript, Lint, Build 통과 확인
5. **Review & Commit:** 정상 동작 시 커밋

## 4. Development Steps
MVP(PRD Phase 1) 내부의 구현 순서. PRD의 로드맵 Phase(2=A vs B 토론장, 3=타임어택 리그, 4=AI 아카이빙)와는 다른 체계다.
* **Step 0:** Project Foundation (Next.js, Tailwind, Supabase 초기화)
* **Step 1:** Auth (이메일 가입, 프로필 닉네임 설정, 운영 계정 시딩 스크립트)
* **Step 2:** Board + Post (boards 스키마, 목록, 상세, 작성, 수정, 삭제)
* **Step 3:** Comment (댓글 조회/작성/대댓글)
* **Step 4:** Editor + OG (Draft 저장, 이미지, URL 감지 및 Python API 호출)
* **Step 5:** MVP Launch (모바일 UX 최적화, 테스트, 배포)

> Poll(투표) 스키마·UI는 PRD Phase 2 — MVP Step에 포함하지 않는다.

## 5. Task Formatting
모든 기능 구현 요청은 다음 포맷을 따른다.
* Goal / Scope / Files / Database Changes / API Changes / UI Changes / Acceptance Criteria

## 6. Tech Stack & Commands
* **Stack:** Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4 / Supabase(Postgres·Auth·Storage) / OG 파서는 별도 Python(FastAPI) 서비스
* **없는 것:** ORM(Prisma 등), 상태관리 라이브러리, UI 킷(shadcn 등), JS 테스트 러너. 이들을 전제로 코드를 쓰지 않는다.
* **Commands**
  * Dev: `npm run dev` / Build: `npm run build`
  * Lint: `npm run lint` / Type check: `npx tsc --noEmit`
  * Migration: `supabase migration new <name>` → `supabase db push`
  * 운영 계정 시딩: `npm run seed:accounts`
  * OG 파서 테스트: `cd og-parser && pytest`

## 7. Code Conventions
* **디렉토리:** `app/`(라우트) · `components/`(평면, 하위 폴더 없음) · `lib/`(공용 로직·타입·Supabase 클라이언트). 두 곳 이상에서 쓰는 쿼리/타입은 `lib/`로 올린다.
* **네이밍:** 컴포넌트 `PascalCase.tsx`, 유틸/훅 `camelCase.ts`, 라우트 폴더 `kebab-case`.
* **주석·사용자 문구:** 한국어로 쓴다. 주석은 "무엇"이 아니라 "왜"를 적는다.
* **TypeScript:** props와 쿼리 응답에 명시적 타입을 붙인다. `any` 금지, 외부 입력은 `unknown`으로 받아 좁힌다.
* **데이터 접근:** 조회는 Server Component에서 `lib/supabase/server`로, 변경은 Client Component에서 `lib/supabase/client`로 한다. `admin`(service_role)은 Route Handler 전용이다.
* **에러 응답:** Route Handler는 `Response.json({ error: "한국어 메시지" }, { status })` 형식을 지킨다.
* **비동기 UI:** 데이터를 기다리는 화면에는 `loading.tsx`(또는 스켈레톤)와 빈 상태 문구를 반드시 함께 만든다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
