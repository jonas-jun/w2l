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
* **`posts`:** 누구나(SELECT published), 작성자(UPDATE, DELETE), 로그인 유저(INSERT)
* **`comments`:** 누구나(SELECT), 작성자(UPDATE, DELETE), 로그인 유저(INSERT)
* **`poll_votes`:** 로그인 유저(INSERT), 자신의 투표(SELECT), 타인 투표 조회 제한

## 4. Key Technical Decisions
* **Editor & Auto Save:** content가 변경된 경우에만 LocalStorage에 5초 단위 debounce 임시저장 적용.
* **Open Graph (OG) API:** SSRF 공격 방어를 위해 private IP, localhost 차단 및 redirect 제한이 적용된 별도 Python Microservice 운용.
* **Real-time:** Supabase Realtime은 댓글 추가, 투표 결과 등 특정 요소에만 제한적으로 적용하여 비용/성능 최적화.