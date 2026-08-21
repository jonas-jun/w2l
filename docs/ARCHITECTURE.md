# System Architecture

## 1. Backend Architecture
전체 구조는 명확한 역할 분리를 지향한다.

┌───────────────┐
│   Next.js     │ (Vercel) - UI, Routing, 사용자 이벤트 처리
└───────┬───────┘
        │
        ├───────────────┐
        ▼               ▼
┌──────────────┐  ┌──────────────┐
│   Supabase   │  │ Cloud Run    │ (Python API)
│              │  │              │
│ PostgreSQL   │  │ OG Parser    │
│ Auth/Storage │  │ NLP Future   │
└──────────────┘  └──────────────┘

## 2. API Boundary
* **Database CRUD:** Supabase (Client에서 직접 호출, RLS로 보호)
* **External / Compute Heavy:** Cloud Run Backend API (외부 URL Fetch, OG Parsing, AI 처리 등)

## 3. Supabase Security (RLS)
* **`posts`:** SELECT — 누구나(`status = PUBLISHED`), 작성자는 자신의 DRAFT 포함. DELETED는 모든 공개 조회에서 제외. INSERT — 로그인 유저(`author_id = auth.uid()`). UPDATE/DELETE — 작성자.
* **`comments`:** 누구나(SELECT), 작성자(UPDATE, DELETE), 로그인 유저(INSERT)
* **`profiles`:** 누구나(SELECT), 본인(INSERT, UPDATE — `id = auth.uid()`)
* **`boards`:** 누구나(SELECT). 쓰기 정책 없음 — 게시판 생성·수정은 마이그레이션 또는 service_role로만 한다.
* **`polls` / `poll_options`** *(Phase 2)*: 누구나(SELECT). 생성은 `create_poll_post` RPC 경유만 허용 — 클라이언트 직접 INSERT 차단.
* **`poll_votes`** *(Phase 2)*: 로그인 유저(INSERT — `user_id = auth.uid()`, 1인 1회는 UNIQUE 제약), 자신의 투표만(SELECT). **집계(결과 게이지)는 타인 행을 노출하지 않고 `get_poll_results` RPC로만 제공한다.**
* **`post_likes` / `comment_likes`:** 누구나(SELECT), 본인 행만(INSERT, DELETE — `user_id = auth.uid()`)
* **`link_previews`:** 누구나(SELECT). 쓰기는 서버 전용 — Next.js Route Handler(`/api/og`)가 service_role로 upsert한다. 클라이언트 직접 쓰기 없음.

### 3.1 RLS 우회 경로 (SECURITY DEFINER RPC / Trigger)
클라이언트 직접 CRUD로 불가능한 동작은 아래 목록으로 한정한다. 이 외의 RLS 우회는 금지.
* **`increment_view_count(post_id)`** — 비로그인 포함 누구나 호출. `posts.view_count` +1 (posts UPDATE가 작성자 전용이므로 RPC 필요).
* **`get_poll_results(poll_id)`** *(Phase 2)* — 옵션별 득표수만 반환. 개별 투표 행은 노출하지 않는다.
* **`create_poll_post(...)`** *(Phase 2)* — `posts` + `polls` + `poll_options`(2개)를 단일 트랜잭션으로 생성. 고아 레코드 방지.
* **like_count 캐시 갱신** — `posts.like_count` / `comments.like_count`는 `post_likes` / `comment_likes`의 INSERT/DELETE 트리거로만 갱신한다. 클라이언트가 직접 UPDATE하지 않는다.

## 4. Key Technical Decisions
* **인증 (MVP): 이메일 + 비밀번호 가입.** 소셜 로그인은 Supabase에서 추가 과금이 없지만(무료 티어 MAU 50,000, Google/Kakao OAuth API 무료), OAuth 앱 등록·심사 없이 시작할 수 있고 운영 계정 시딩(§5)이 쉬운 email 가입을 MVP로 택한다. 소셜 로그인은 Phase 2에서 추가 (Supabase는 두 방식을 병행 지원하므로 마이그레이션 부담 없음).
  * 확인 메일 발송: Supabase 내장 SMTP는 시간당 발송 제한이 있어 데모 수준이다. 정식 오픈 전에 커스텀 SMTP(예: Resend 무료 티어)를 연결한다.
* **본문 포맷:** `posts.content`는 **`posts.content_format`이 선언하는 포맷의 원문**으로 저장한다 (`MARKDOWN` | `PLAIN`, issue #5). 저장 시 이스케이프·변환을 하지 않으므로 편집 왕복에서 본문이 손실되지 않고, 렌더링만 이 값으로 분기한다(`components/PostBody.tsx`).
  * **Markdown 모드:** 이미지·URL을 마크다운 문법으로 본문에 삽입하고, 에디터는 툴바로 문법을 감춘다. AI 아카이빙(Phase 3)·SEO 변환이 쉬운 것이 선정 이유.
  * **Plain Text 모드:** 서식이 필요 없는 사용자를 위한 모드다. 단일 개행이 마크다운에서 접히는 문제(soft break)를 피하려 `white-space: pre-wrap`으로 그대로 렌더하고, 마크다운 문법은 해석하지 않는다. 이미지는 URL 단독 줄로 넣고 렌더러가 `<img>`로 그린다. 새 글의 기본 모드이며, 마지막에 고른 모드를 LocalStorage에 기억한다.
  * **두 모드 공통:** 단독 줄 URL은 OG 카드로, 단독 줄 이미지 URL은 `<img>`로 렌더한다. 모드를 바꿔도 같은 본문이 같게 보여야 하기 때문이다(이미지 URL은 OG 파싱 대상에서 제외한다 — `lib/og.ts`의 `isImageUrl`). 단 마크다운에서 "단독 줄"은 문단 단위라, 앞 줄과 빈 줄로 떨어져 있지 않은 URL은 soft break로 합쳐져 카드가 되지 않는다.
* **Editor & Auto Save:** content가 변경된 경우에만 LocalStorage에 5초 단위 debounce 임시저장 적용.
* **Open Graph (OG) API:** SSRF 공격 방어를 위해 private IP, localhost 차단 및 redirect 제한이 적용된 별도 Python Microservice 운용.
* **OG 캐시:** 파싱 결과는 `link_previews` 테이블에 URL 단위로 캐시한다 (`fetched_at` 기준 7일 경과 시 재파싱). 렌더링 시 Cloud Run을 직접 호출하지 않는다 — 작성 시점에 파싱·저장하고, 조회는 DB에서 읽는다.
* **Real-time:** Supabase Realtime은 댓글 추가, 투표 결과 등 특정 요소에만 제한적으로 적용하여 비용/성능 최적화.

## 5. 운영 계정 시딩 (Seed Accounts)
오픈 초기 콘텐츠를 채우기 위해 운영자용 계정 10개를 사전 생성한다.
* **방법:** Supabase Admin API(`auth.admin.createUser`, `email_confirm: true`)를 호출하는 시딩 스크립트(`scripts/seed-accounts.ts`)를 로컬에서 실행한다. 계정마다 `profiles` 행(닉네임)을 함께 생성한다.
* **보안:** service_role key가 필요하므로 스크립트는 서버/로컬 전용이다 — 클라이언트 번들·레포에 key를 넣지 않는다 (CLAUDE.md 제약). 계정 목록(이메일/닉네임)은 env 또는 로컬 파일로 주입하고 커밋하지 않는다.
* **범위:** 이 계정들은 일반 사용자와 동일한 권한이다(별도 admin 롤 없음 — 관리자 CMS는 로드맵 후순위). 시딩 글 작성은 해당 계정으로 로그인해 일반 플로우로 한다.