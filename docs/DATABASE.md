# Database Architecture & Rules

## 1. Core Data Models
### 1.1 Post Model (`posts`)
일반 게시글과 대결(Poll) 게시글을 하나의 모델로 관리.
* **Fields:** `id`, `author_id`, `title`, `content`, `post_type` (NORMAL/POLL), `status` (DRAFT/PUBLISHED/DELETED), `view_count`, `created_at`, `updated_at`, `deleted_at`

### 1.2 Poll Model (이벤트 테이블 구조)
단순 카운터가 아닌 중복 투표 방지 및 추적을 위한 분리.
* **`polls`:** `id`, `post_id`, `created_at`, `closed_at`
* **`poll_options`:** `id`, `poll_id`, `label`, `display_order`
* **`poll_votes`:** `id`, `poll_id`, `option_id`, `user_id`, `created_at`
* **Constraint:** `UNIQUE (poll_id, user_id)`

### 1.3 Comment Model (`comments`)
1-depth 대댓글을 위한 self-reference 구조.
* **Fields:** `id`, `post_id`, `author_id`, `parent_id` (NULL은 일반, comment.id는 대댓글), `content`, `like_count`, `created_at`, `updated_at`, `deleted_at`

### 1.4 User Profile (`profiles`)
Supabase Auth와 분리된 서비스 프로필.
* **Fields:** `id` (auth.users.id), `nickname`, `tier`, `avatar_url`, `created_at`, `updated_at`
* **Constraint:** `UNIQUE (nickname)`

### 1.5 추천/Like 시스템
이벤트 테이블 기반 설계.
* **`post_likes`:** `id`, `post_id`, `user_id`, `created_at` (UNIQUE: post_id, user_id)
* **`comment_likes`:** `id`, `comment_id`, `user_id`, `created_at` (UNIQUE: comment_id, user_id)

## 2. Database Design Rules
* **Rule 1:** 모든 테이블은 UUID 기반 primary key 사용.
* **Rule 2:** 기본 필드 (`id`, `created_at`, `updated_at`) 필수.
* **Rule 3:** 삭제가 필요한 콘텐츠는 soft delete (`deleted_at`) 고려.
* **Rule 4:** 사용자별 중복 행위는 DB Constraint로 방어.

## 3. Recommended ERD
auth.users
    │ (1:1)
    └── profiles
          │
          ├── posts
          │     ├── post_images
          │     ├── polls
          │     │     ├── poll_options
          │     │     │     └── poll_votes
          │     ├── post_likes
          │     └── comments
          │            └── comment_likes
          └── user activities