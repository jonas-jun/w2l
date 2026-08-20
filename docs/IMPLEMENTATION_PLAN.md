# MVP 구현 계획서 (Implementation Plan)

> **실행 AI에게**: 이 문서는 w2l MVP의 전체 구현 순서다. 태스크를 **위에서부터 순서대로,
> 한 번에 하나씩** 수행하라. 각 태스크는 이전 태스크까지 완료된 상태를 전제한다.
> 설계 판단이 필요해 보이면 임의로 결정하지 말고, 이 문서와 `PRD.md` · `ARCHITECTURE.md` ·
> `DATABASE.md` · 루트 `CLAUDE.md`에서 근거를 찾아라. 네 문서 어디에도 답이 없으면 **멈추고
> 사용자에게 질문하라** — 추측으로 구현하지 않는다.

## 0. 공통 규칙 (모든 태스크에 적용)

1. **시작 전**: 해당 태스크의 Files 목록과 관련 문서 절을 읽는다. 태스크 범위 밖 파일은
   수정하지 않는다.
2. **완료 정의(DoD)**: 아래 3개가 모두 통과하고, 태스크의 Acceptance Criteria를 전부 만족한다.
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
3. **커밋 단위 = 태스크**. 태스크 하나가 끝나면 `feat: [T2.3] 게시글 상세` 형식으로 커밋한다.
   태스크 중간에 커밋하지 않는다.
4. **DB 변경은 반드시 마이그레이션으로**: `supabase/migrations/`에 SQL 파일 추가
   (`supabase migration new <name>`). 대시보드에서 손으로 바꾸지 않는다. 모든 테이블은
   생성 직후 같은 마이그레이션에서 `ENABLE ROW LEVEL SECURITY` + 정책까지 만든다.
5. **금지 사항** (루트 CLAUDE.md): RLS 우회 금지, service_role key 클라이언트 노출 금지,
   근거 없는 의존성 추가 금지(§1 승인 목록 외 의존성은 사용자 승인 필요), PRD Phase 2~4
   기능(투표, 소셜 로그인, 타임어택, AI) 구현 금지.
6. **범위 밖 문제 발견 시**: 고치지 말고 태스크 완료 보고에 "발견한 문제"로 적는다.

## 1. 고정 결정 사항 (변경 금지)

### 기술 스택 · 승인된 의존성
| 용도 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router, TypeScript) | `create-next-app` 최신 안정판 |
| 스타일 | Tailwind CSS | create-next-app 옵션으로 포함 |
| DB/Auth/Storage | Supabase — `@supabase/supabase-js`, `@supabase/ssr` | |
| 마크다운 렌더 | `react-markdown` + `remark-gfm` | HTML 렌더 비활성(기본값) 유지 — XSS 방지 |
| 날짜 표시 | 직접 구현 (`lib/format.ts`의 상대시간 함수) | 라이브러리 추가 금지 |
| OG 파서 (Step 4) | Python FastAPI + httpx + BeautifulSoup | Cloud Run 배포 |

위 표에 없는 패키지가 필요하면 멈추고 사용자에게 물어본다.

### 디렉토리 구조
```
app/                    # 라우트 (App Router)
components/             # 공용 UI 컴포넌트
lib/supabase/           # server.ts(서버 클라이언트) · client.ts(브라우저 클라이언트)
lib/                    # format.ts, constants.ts 등 유틸
supabase/migrations/    # SQL 마이그레이션
scripts/                # seed-accounts.ts 등 로컬 전용 스크립트
og-parser/              # Step 4의 Python 서비스 (별도 배포 단위)
```

### 라우트 맵 (MVP 전체)
| 경로 | 내용 | 접근 |
|---|---|---|
| `/` | 홈 피드 (인기 섹션 + 최신 목록) | 공개 |
| `/popular` | 인기 탭 (최근 72h like_count 순) | 공개 |
| `/posts/[id]` | 게시글 상세 + 댓글 | 공개 |
| `/write`, `/write/[id]` | 작성 / 수정 | 로그인 |
| `/profile` | 내 정보, 내 글, 로그아웃 | 로그인 |
| `/login`, `/signup` | 이메일 로그인 / 가입 | 공개 |
| `/onboarding/nickname` | 최초 닉네임 설정 | 로그인 |
| `/api/og` | OG 파싱 프록시 + 캐시 (Route Handler) | 로그인 |

### 환경 변수
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (클라이언트 허용),
`SUPABASE_SERVICE_ROLE_KEY`, `OG_PARSER_URL` (서버 전용 — `NEXT_PUBLIC_` 접두사 금지).
`.env.local`은 gitignore 대상이며, `.env.example`에 키 이름만 커밋한다.

---

## Step 0 — Project Foundation

### T0.1 Next.js 스캐폴드
* **Goal:** 빌드 가능한 빈 앱.
* **Scope:** `create-next-app`(TypeScript, Tailwind, App Router, ESLint, `src/` 미사용).
  README 정리. 기능 구현 없음.
* **Files:** 프로젝트 루트 일체, `.env.example`
* **Acceptance Criteria:** `npm run dev` 기동, `npm run build` 통과. 기존
  `docs/` · `CLAUDE.md` · `.gitignore` 항목이 삭제되지 않았다 (`.gitignore`는 create-next-app
  산출물과 기존 내용을 병합).

### T0.2 Supabase 연결
* **Goal:** 서버/클라이언트 양쪽에서 Supabase 호출 가능.
* **Scope:** Supabase 프로젝트는 **사용자가 대시보드에서 생성**해 URL/key를 `.env.local`에
  넣는다(AI는 요청만 한다). `supabase` CLI 초기화(`supabase init`), `lib/supabase/server.ts`
  (`@supabase/ssr`의 `createServerClient`, cookie 연동) · `lib/supabase/client.ts`
  (`createBrowserClient`) 작성.
* **Files:** `lib/supabase/server.ts`, `lib/supabase/client.ts`, `supabase/config.toml`
* **Acceptance Criteria:** 서버 컴포넌트에서 `supabase.auth.getUser()` 호출이 에러 없이
  null user를 반환한다(아직 미로그인).

### T0.3 모바일 셸 + Bottom Navigation
* **Goal:** 모든 페이지가 공유하는 모바일 퍼스트 레이아웃.
* **Scope:** `app/layout.tsx`에 max-width 640px 중앙 정렬 컨테이너, 하단 고정 Bottom Nav
  4탭 **[홈 /] [인기 /popular] [글쓰기 /write] [프로필 /profile]** (PRD §5 — [대결] 탭은
  Phase 2이므로 만들지 않는다). 각 탭의 빈 페이지(placeholder) 생성.
* **Files:** `app/layout.tsx`, `components/BottomNav.tsx`, `app/page.tsx`,
  `app/popular/page.tsx`, `app/write/page.tsx`, `app/profile/page.tsx`
* **UI Changes:** 현재 경로의 탭 활성 표시. 뷰포트 375px 기준으로 확인.
* **Acceptance Criteria:** 4개 탭 이동이 동작하고 모든 페이지에서 Nav가 하단 고정된다.

## Step 1 — Auth

### T1.1 마이그레이션: profiles + boards
* **Goal:** 사용자 프로필과 게시판 테이블.
* **Database Changes** (`DATABASE.md` §1.0 · §1.4 그대로):
  * `profiles`: `id uuid PK REFERENCES auth.users ON DELETE CASCADE`, `nickname text UNIQUE NOT NULL`,
    `tier text` (예약 — 코드에서 사용 금지), `avatar_url text`, `created_at`, `updated_at`
  * `boards`: `id uuid PK DEFAULT gen_random_uuid()`, `slug text UNIQUE NOT NULL`,
    `name text NOT NULL`, `display_order int NOT NULL DEFAULT 0`, `created_at`
  * seed: `INSERT INTO boards (slug, name) VALUES ('free', '자유게시판');`
  * RLS (`ARCHITECTURE.md` §3): profiles — SELECT 누구나 / INSERT·UPDATE 본인(`id = auth.uid()`).
    boards — SELECT 누구나, 쓰기 정책 없음.
* **Files:** `supabase/migrations/*_profiles_boards.sql`
* **Acceptance Criteria:** `supabase db reset` 통과, anon 키로 boards SELECT 가능,
  profiles INSERT는 미로그인 시 거부됨.

### T1.2 이메일 가입 / 로그인 / 닉네임 온보딩
* **Goal:** 가입 → 닉네임 설정 → 로그인 상태 유지.
* **Scope:** `signUp`/`signInWithPassword`/`signOut`. 가입 직후 `profiles` 행이 없으면
  `/onboarding/nickname`으로 리다이렉트하는 미들웨어. 닉네임 제약: 2~12자, 한글/영문/숫자,
  UNIQUE 위반 시 인라인 에러. **개발 단계에서는 Supabase 대시보드에서 이메일 확인(confirm)을
  꺼둔다** — 켜는 것은 T5.2. 소셜 로그인 버튼을 만들지 않는다.
* **Files:** `app/login/page.tsx`, `app/signup/page.tsx`, `app/onboarding/nickname/page.tsx`,
  `middleware.ts`, `app/profile/page.tsx` (내 닉네임 표시 + 로그아웃 버튼)
* **API Changes:** 없음 (Supabase 클라이언트 직접 호출).
* **Acceptance Criteria:** 가입→닉네임→홈 플로우 완주. 새로고침 후 세션 유지.
  닉네임 없는 로그인 유저는 어느 페이지로 가도 온보딩으로 강제 이동.
  `/write`·`/profile`은 미로그인 시 `/login`으로 리다이렉트.

### T1.3 운영 계정 시딩 스크립트
* **Goal:** 운영자용 계정 약 20개 일괄 생성 (`ARCHITECTURE.md` §5).
* **Scope:** `scripts/seed-accounts.ts` — 로컬 CSV(`scripts/accounts.local.csv`,
  gitignore 대상: email,password,nickname)를 읽어 `auth.admin.createUser({ email_confirm: true })`
  + `profiles` INSERT. 멱등(이미 있으면 skip). `SUPABASE_SERVICE_ROLE_KEY`는 env로만 주입.
* **Files:** `scripts/seed-accounts.ts`, `.gitignore`에 `scripts/*.local.csv` 추가
* **Acceptance Criteria:** 스크립트 2회 실행해도 에러 없음(멱등). 생성 계정으로 로그인 가능.
  CSV·service key가 커밋되지 않음 (`git status`로 확인).

## Step 2 — Board + Post

### T2.1 마이그레이션: posts + likes + view_count RPC
* **Goal:** 게시글 저장 구조 전체.
* **Database Changes** (`DATABASE.md` §1.1 · §1.5, `ARCHITECTURE.md` §3 · §3.1):
  * `posts`: `id`, `board_id FK boards NOT NULL`, `author_id FK profiles NOT NULL`,
    `title text NOT NULL`, `content text NOT NULL DEFAULT ''`,
    `post_type text NOT NULL DEFAULT 'NORMAL' CHECK (post_type = 'NORMAL')` — POLL 값은
    Phase 2 마이그레이션에서 CHECK를 완화하며 추가한다,
    `status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','DELETED'))`,
    `view_count int NOT NULL DEFAULT 0`, `like_count int NOT NULL DEFAULT 0`,
    `created_at`, `updated_at`, `deleted_at`
  * `post_likes`: `id`, `post_id FK`, `user_id FK`, `created_at`, `UNIQUE(post_id, user_id)`
  * 인덱스: `(status, created_at DESC)`, `(status, like_count DESC, created_at DESC)`
  * RLS: posts — SELECT `status='PUBLISHED' OR author_id=auth.uid()` (DELETED는 작성자 포함
    목록에서 숨기되 소유 확인용으로 작성자 SELECT는 허용), INSERT 로그인+본인,
    UPDATE/DELETE 작성자. post_likes — SELECT 누구나, INSERT/DELETE 본인.
  * RPC `increment_view_count(p_post_id uuid)`: SECURITY DEFINER, view_count+1.
  * 트리거: post_likes INSERT/DELETE → posts.like_count ±1.
* **Files:** `supabase/migrations/*_posts.sql`
* **Acceptance Criteria:** `supabase db reset` 통과. anon으로 PUBLISHED만 조회됨.
  타인 글 UPDATE 시도 거부. like INSERT→like_count 1 증가, DELETE→감소 확인(SQL로 검증).

### T2.2 게시글 작성 / 수정 / 삭제
* **Goal:** 글쓰기 코어 루프의 입력부.
* **Scope:** `/write` — 제목 + 본문 textarea(마크다운 원문 그대로 저장, 미리보기·툴바는
  T4.1). "등록"은 `status='PUBLISHED'`로 INSERT, `/write/[id]`는 본인 글 수정.
  삭제는 상세 페이지에서 본인 글에만 노출 — `status='DELETED'` + `deleted_at=now()`
  동시 세팅(UPDATE, 물리 삭제 금지). board는 'free' 고정(선택 UI 없음 — 게시판이 1개다).
* **Files:** `app/write/page.tsx`, `app/write/[id]/page.tsx`, `components/PostForm.tsx`
* **Acceptance Criteria:** 작성→상세 이동, 수정 반영, 삭제 후 목록·상세에서 사라짐.
  타인 글 수정 URL 직접 접근 시 홈으로 리다이렉트.

### T2.3 목록 (홈 + 인기 탭)
* **Goal:** 피드.
* **Scope:** 홈 `/`: 인기 섹션(아래 인기 쿼리 상위 5) + 최신 목록(PUBLISHED,
  `created_at DESC`, 20개 페이지네이션 — "더 보기" 버튼 방식). 인기 탭 `/popular`:
  **최근 72시간 내 PUBLISHED를 `like_count DESC, created_at DESC`로 정렬** (PRD §5 산식,
  임의 변경 금지). 목록 카드: 제목, 닉네임, 상대시간, 추천수, 댓글수(댓글 구현 전엔 생략),
  조회수. 서버 컴포넌트에서 조회.
* **Files:** `app/page.tsx`, `app/popular/page.tsx`, `components/PostCard.tsx`, `lib/format.ts`
* **Acceptance Criteria:** 두 목록이 산식대로 정렬됨(글 3개 이상 만들어 확인).
  DRAFT·DELETED 글이 목록에 안 보임.

### T2.4 게시글 상세
* **Goal:** 읽기 화면.
* **Scope:** `/posts/[id]` — 제목, 작성자 닉네임, 상대시간, 마크다운 렌더(`react-markdown`
  + `remark-gfm`, HTML 렌더 금지), 조회수. 페이지 로드 시 `increment_view_count` RPC 1회
  호출(중복 방지 로직은 넣지 않는다 — MVP 단순 증가). DRAFT는 작성자에게만 보이고
  타인 접근 시 404.
* **Files:** `app/posts/[id]/page.tsx`, `components/Markdown.tsx`
* **Acceptance Criteria:** 새로고침마다 조회수 증가. 마크다운 제목/목록/링크 렌더 확인.
  `<script>` 포함 본문이 텍스트로만 표시됨.

### T2.5 추천 (post_likes)
* **Goal:** 추천 토글.
* **Scope:** 상세 페이지 추천 버튼 — 미추천이면 INSERT, 이미 추천이면 DELETE(토글).
  내 추천 여부 표시. 미로그인 클릭 시 `/login` 이동. 카운트 표시는 `posts.like_count`
  캐시를 읽는다(직접 집계 금지).
* **Files:** `app/posts/[id]/page.tsx`, `components/LikeButton.tsx`
* **Acceptance Criteria:** 토글 동작, 새로고침 후 상태 유지, 다른 계정에서 카운트 합산 확인.

## Step 3 — Comment

### T3.1 마이그레이션: comments + comment_likes
* **Database Changes** (`DATABASE.md` §1.3 · §1.5): `comments`(`id`, `post_id FK`,
  `author_id FK`, `parent_id FK comments NULL`, `content text NOT NULL`,
  `like_count int DEFAULT 0`, `created_at`, `updated_at`, `deleted_at`),
  `comment_likes`(UNIQUE(comment_id, user_id)). **1-depth 강제**: `parent_id`가 가리키는
  댓글의 `parent_id`는 NULL이어야 함 — 트리거로 검증. RLS는 ARCHITECTURE §3.
  comment_likes 트리거로 like_count 갱신.
* **Files:** `supabase/migrations/*_comments.sql`
* **Acceptance Criteria:** `db reset` 통과. 대댓글의 대댓글 INSERT가 거부됨.

### T3.2 댓글 UI (조회/작성/수정/삭제/대댓글/추천)
* **Goal:** 상세 페이지 하단 댓글 스레드.
* **Scope:** 원댓글 `created_at ASC`, 대댓글은 부모 아래 들여쓰기. 본인 댓글에 수정/삭제.
  삭제는 soft delete — **대댓글이 있으면 "삭제된 댓글입니다" 표시로 자리 유지, 없으면
  화면에서 제거** (PRD §4.1). 댓글 추천은 T2.5와 동일 패턴.
* **Files:** `components/CommentSection.tsx`, `components/CommentItem.tsx`,
  `app/posts/[id]/page.tsx`
* **Acceptance Criteria:** 작성/수정/삭제/대댓글/추천 전부 동작. 삭제 표시 규칙 확인.
  목록 카드(PostCard)에 댓글수 표시 추가.

### T3.3 댓글 Realtime
* **Goal:** 보고 있는 글에 새 댓글이 실시간 반영.
* **Scope:** Supabase Realtime 채널을 **comments INSERT + 현재 post_id 필터로만** 구독
  (ARCHITECTURE §4 — 범위 확대 금지). 페이지 이탈 시 구독 해제.
* **Files:** `components/CommentSection.tsx`
* **Acceptance Criteria:** 두 브라우저로 같은 글을 열고 한쪽 작성 → 다른 쪽에 수초 내 표시.

## Step 4 — Editor + OG

### T4.1 에디터 고도화 + Draft 자동저장
* **Goal:** 모바일에서 쓸 만한 마크다운 입력기.
* **Scope:** PostForm에 툴바(굵게, 링크, 이미지 자리) + 미리보기 탭. **자동저장:
  content 변경 시에만 5초 debounce로 LocalStorage 임시저장** (ARCHITECTURE §4 결정 그대로).
  작성 페이지 재진입 시 임시본 복원 배너. "임시저장" 버튼은 `status='DRAFT'`로 서버 저장,
  `/profile`에 내 Draft 목록 추가.
* **Files:** `components/PostForm.tsx`, `components/MarkdownToolbar.tsx`, `app/profile/page.tsx`
* **Acceptance Criteria:** 입력 5초 후 새로고침해도 복원됨. Draft가 목록/타인에게 안 보임.

### T4.2 이미지 업로드
* **Goal:** 본문 이미지.
* **Scope:** Supabase Storage 버킷 `post-images`(public read, 로그인 업로드 — Storage 정책
  마이그레이션 포함). 툴바 버튼 → 파일 선택 → 업로드 → 본문 커서 위치에
  `![](public URL)` 삽입 + `post_images` 행 기록(storage_path, display_order). 5MB 제한,
  이미지 MIME만 허용.
* **Files:** `supabase/migrations/*_storage_post_images.sql` (버킷·정책 + `post_images` 테이블,
  `DATABASE.md` §1.6), `components/PostForm.tsx`
* **Acceptance Criteria:** 업로드한 이미지가 상세에서 렌더. 6MB 파일·.txt 파일이 거부됨.

### T4.3 OG 파서 서비스 (Python / Cloud Run)
* **Goal:** URL → OG 메타데이터.
* **Scope:** `og-parser/` FastAPI 단일 엔드포인트 `POST /parse {url}` →
  `{title, description, image_url}`. **SSRF 방어 필수** (ARCHITECTURE §4): http(s)만 허용,
  DNS 해석 결과가 private/loopback/link-local IP면 거부, 리다이렉트 최대 3회(매 hop 재검사),
  타임아웃 5초, 응답 1MB 제한, `text/html`만 파싱. `X-API-Key` 헤더 인증(공유 시크릿).
  Dockerfile 포함. Cloud Run 배포는 사용자가 수행(배포 커맨드를 README에 적는다).
* **Files:** `og-parser/main.py`, `og-parser/requirements.txt`, `og-parser/Dockerfile`,
  `og-parser/README.md`, `og-parser/test_main.py`
* **Acceptance Criteria:** 로컬 pytest 통과 — 정상 URL 파싱, `http://169.254.169.254` ·
  `http://localhost` · private IP로 리다이렉트되는 URL이 전부 거부됨.

### T4.4 URL 감지 → OG 카드
* **Goal:** 본문 속 URL이 카드로 보인다.
* **Scope:** 마이그레이션으로 `link_previews` 생성(`DATABASE.md` §1.7, RLS: SELECT 누구나,
  쓰기 정책 없음). Route Handler `/api/og` (로그인 필수): URL 정규화 → `link_previews`
  조회 → `fetched_at` 7일 이내면 캐시 반환, 아니면 OG 파서 호출 후 service_role로 upsert.
  작성 시 본문에 단독 줄 URL이 있으면 `/api/og` 호출(작성 시점 파싱 — 조회 시 호출 금지,
  ARCHITECTURE §4). 상세 렌더 시 단독 줄 URL을 OG 카드 컴포넌트로 치환.
* **Files:** `supabase/migrations/*_link_previews.sql`, `app/api/og/route.ts`,
  `components/OgCard.tsx`, `components/Markdown.tsx`
* **Acceptance Criteria:** 뉴스 URL 포함 글에서 카드(제목/설명/이미지) 표시. 같은 URL 두 번째
  글은 파서 호출 없이 캐시 사용(파서 로그로 확인). OG 없는 URL은 일반 링크로 표시.

## Step 5 — MVP Launch

### T5.1 UX 마감
* **Scope:** 전 페이지 로딩(`loading.tsx`)·에러(`error.tsx`)·빈 상태 화면, 404, 폼 중복 제출
  방지, 메타태그(title/description), 라이트하우스 모바일 점검. 신규 기능 추가 금지.
* **Acceptance Criteria:** 주요 플로우(가입→글→댓글→추천)를 375px 뷰포트에서 완주,
  콘솔 에러 0건.

### T5.2 프로덕션 인증 설정
* **Scope:** Supabase 이메일 확인(confirm) 켜기 + 커스텀 SMTP 연결(ARCHITECTURE §4 —
  대시보드 작업이므로 **사용자에게 절차를 안내**하고 확인받는다). 확인 메일 리다이렉트 URL을
  프로덕션 도메인으로 설정.
* **Acceptance Criteria:** 실제 이메일로 가입 → 확인 메일 수신 → 인증 완료.

### T5.3 배포
* **Scope:** Vercel 연결(사용자 계정), 환경 변수 등록(서버 전용 키는 서버 env로만),
  프로덕션 스모크 테스트. `supabase db push`로 프로덕션 마이그레이션 적용.
* **Acceptance Criteria:** 프로덕션 URL에서 T5.1의 플로우 완주. 운영 계정(T1.3)으로
  글 작성 가능.

---

## 진행 체크리스트

- [x] T0.1 Next.js 스캐폴드
- [x] T0.2 Supabase 연결
- [x] T0.3 모바일 셸 + Bottom Nav
- [x] T1.1 마이그레이션: profiles + boards
- [x] T1.2 이메일 가입/로그인/온보딩
- [x] T1.3 운영 계정 시딩 스크립트
- [x] T2.1 마이그레이션: posts + likes + RPC
- [ ] T2.2 작성/수정/삭제
- [ ] T2.3 목록 (홈 + 인기)
- [ ] T2.4 상세
- [ ] T2.5 추천
- [ ] T3.1 마이그레이션: comments
- [ ] T3.2 댓글 UI
- [ ] T3.3 댓글 Realtime
- [ ] T4.1 에디터 + Draft 자동저장
- [ ] T4.2 이미지 업로드
- [ ] T4.3 OG 파서 서비스
- [ ] T4.4 URL 감지 → OG 카드
- [ ] T5.1 UX 마감
- [ ] T5.2 프로덕션 인증 설정
- [ ] T5.3 배포
