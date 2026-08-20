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
* **`polls` / `poll_options`:** 누구나(SELECT). 생성은 `create_poll_post` RPC 경유만 허용 — 클라이언트 직접 INSERT 차단.
* **`poll_votes`:** 로그인 유저(INSERT — `user_id = auth.uid()`, 1인 1회는 UNIQUE 제약), 자신의 투표만(SELECT). **집계(결과 게이지)는 타인 행을 노출하지 않고 `get_poll_results` RPC로만 제공한다.**
* **`post_likes` / `comment_likes`:** 누구나(SELECT), 본인 행만(INSERT, DELETE — `user_id = auth.uid()`)

### 3.1 RLS 우회 경로 (SECURITY DEFINER RPC / Trigger)
클라이언트 직접 CRUD로 불가능한 동작은 아래 목록으로 한정한다. 이 외의 RLS 우회는 금지.
* **`increment_view_count(post_id)`** — 비로그인 포함 누구나 호출. `posts.view_count` +1 (posts UPDATE가 작성자 전용이므로 RPC 필요).
* **`get_poll_results(poll_id)`** — 옵션별 득표수만 반환. 개별 투표 행은 노출하지 않는다.
* **`create_poll_post(...)`** — `posts` + `polls` + `poll_options`(2개)를 단일 트랜잭션으로 생성. 고아 레코드 방지.
* **like_count 캐시 갱신** — `posts.like_count` / `comments.like_count`는 `post_likes` / `comment_likes`의 INSERT/DELETE 트리거로만 갱신한다. 클라이언트가 직접 UPDATE하지 않는다.

## 4. Key Technical Decisions
* **본문 포맷:** `posts.content`는 **Markdown**으로 저장한다. 이미지·URL은 마크다운 문법으로 본문에 삽입하고, 에디터는 툴바로 문법을 감춘다. AI 아카이빙(Phase 3)·SEO 변환이 쉬운 것이 선정 이유.
* **Editor & Auto Save:** content가 변경된 경우에만 LocalStorage에 5초 단위 debounce 임시저장 적용.
* **Open Graph (OG) API:** SSRF 공격 방어를 위해 private IP, localhost 차단 및 redirect 제한이 적용된 별도 Python Microservice 운용.
* **OG 캐시:** 파싱 결과는 `link_previews` 테이블에 URL 단위로 캐시한다 (`fetched_at` 기준 7일 경과 시 재파싱). 렌더링 시 Cloud Run을 직접 호출하지 않는다 — 작성 시점에 파싱·저장하고, 조회는 DB에서 읽는다.
* **Real-time:** Supabase Realtime은 댓글 추가, 투표 결과 등 특정 요소에만 제한적으로 적용하여 비용/성능 최적화.