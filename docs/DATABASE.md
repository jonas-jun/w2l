# Database Architecture & Rules

## 1. Core Data Models
### 1.0 Board Model (`boards`)
MVP는 게시판 1개(자유게시판)로 시작하지만, Phase 2에서 A vs B 토론장 등 게시판을 추가 생성할 수 있도록 처음부터 다중 게시판 구조로 둔다.
* **Fields:** `id`, `slug` (UNIQUE), `name`, `display_order`, `created_at`
* 게시판 생성·수정은 마이그레이션 또는 service_role로만 한다 (일반 사용자 쓰기 없음).

### 1.1 Post Model (`posts`)
일반 게시글과 대결(Poll) 게시글을 하나의 모델로 관리.
* **Fields:** `id`, `board_id`, `author_id`, `title`, `content`, `content_format` (MARKDOWN/PLAIN — `content`를 어떤 포맷의 원문으로 저장했는지, default MARKDOWN), `post_type` (NORMAL/POLL — POLL은 Phase 2), `status` (DRAFT/PUBLISHED/DELETED), `view_count`, `like_count` (트리거 갱신 캐시), `created_at`, `updated_at`, `deleted_at`
* **Invariant:** `status = DELETED ⇔ deleted_at IS NOT NULL` (둘은 항상 함께 세팅한다)

### 1.2 Poll Model (이벤트 테이블 구조) — **Phase 2, MVP에서는 테이블을 생성하지 않는다**
단순 카운터가 아닌 중복 투표 방지 및 추적을 위한 분리. 설계는 확정해두고 Phase 2 마이그레이션으로 도입한다.
* **`polls`:** `id`, `post_id`, `created_at`, `closed_at` (MVP에서는 NULL — 마감 개념은 Phase 2 타임어택 리그용)
* **`poll_options`:** `id`, `poll_id`, `label`, `display_order` — **MVP는 poll당 2개 고정 (A vs B).** `create_poll_post` RPC에서 강제한다.
* **`poll_votes`:** `id`, `poll_id`, `option_id`, `user_id`, `created_at`
* **Constraint:** `UNIQUE (poll_id, user_id)`
* **생성 경로:** POLL 게시글은 `posts`+`polls`+`poll_options` 3테이블 동시 생성이므로 반드시 `create_poll_post` RPC(단일 트랜잭션)로 만든다 (ARCHITECTURE §3.1).

### 1.3 Comment Model (`comments`)
1-depth 대댓글을 위한 self-reference 구조.
* **Fields:** `id`, `post_id`, `author_id`, `parent_id` (NULL은 일반, comment.id는 대댓글), `content`, `like_count`, `created_at`, `updated_at`, `deleted_at`

### 1.4 User Profile (`profiles`)
Supabase Auth와 분리된 서비스 프로필.
* **Fields:** `id` (auth.users.id), `nickname`, `tier` (예약 컬럼 — 티어는 Phase 2 기능, MVP에서는 계산·표시하지 않음), `avatar_url`, `created_at`, `updated_at`
* **Constraint:** `UNIQUE (nickname)`

### 1.5 추천/Like 시스템
이벤트 테이블 기반 설계.
* **`post_likes`:** `id`, `post_id`, `user_id`, `created_at` (UNIQUE: post_id, user_id)
* **`comment_likes`:** `id`, `comment_id`, `user_id`, `created_at` (UNIQUE: comment_id, user_id)
* `posts.like_count` / `comments.like_count` 캐시는 이 테이블들의 INSERT/DELETE 트리거로 갱신한다.

### 1.6 이미지 (`post_images`)
Supabase Storage에 업로드하고 메타데이터만 DB에 둔다.
* **Fields:** `id`, `post_id`, `storage_path`, `display_order`, `created_at`

### 1.7 OG 캐시 (`link_previews`)
Cloud Run OG 파서 결과의 URL 단위 캐시 (ARCHITECTURE §4).
* **Fields:** `id`, `url` (UNIQUE, 정규화 후 저장), `og_title`, `og_description`, `og_image_url`, `fetched_at`, `created_at`

## 2. Database Design Rules
* **Rule 1:** 모든 테이블은 UUID 기반 primary key 사용.
* **Rule 2:** 기본 필드 (`id`, `created_at`, `updated_at`) 필수. 단, 행이 불변인 이벤트 테이블(`poll_votes`, `post_likes`, `comment_likes`)은 `updated_at`을 생략한다.
* **Rule 3:** 삭제가 필요한 콘텐츠는 soft delete (`deleted_at`) 고려.
* **Rule 4:** 사용자별 중복 행위는 DB Constraint로 방어.

## 3. Recommended ERD
auth.users                          boards
    │ (1:1)                            │ (1:N)
    └── profiles                       │
          │                            │
          ├── posts ──────────────────┘
          │     ├── post_images
          │     ├── polls                    (Phase 2)
          │     │     ├── poll_options       (Phase 2)
          │     │     │     └── poll_votes   (Phase 2)
          │     ├── post_likes
          │     └── comments
          │            └── comment_likes
          └── (user activities — 로드맵 후순위, MVP 범위 아님)

link_previews (독립 테이블 — URL 단위 OG 캐시, posts와 FK 없음)