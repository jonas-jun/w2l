/** 목록(홈·인기)에서 쓰는 게시글 행. */
export interface PostListRow {
  id: string;
  title: string;
  created_at: string;
  like_count: number;
  view_count: number;
  profiles: { nickname: string } | null;
  comments: { count: number }[];
}

/**
 * 목록용 select. 댓글수는 삭제되지 않은 댓글만 세야 하므로
 * 쿼리에 `.is("comments.deleted_at", null)` embedded 필터를 함께 건다.
 */
export const POST_LIST_SELECT =
  "id, title, created_at, like_count, view_count, profiles(nickname), comments(count)";

/** 목록 카드에 표시할 댓글수. embedded aggregate는 배열로 온다. */
export function commentCountOf(post: PostListRow): number {
  return post.comments[0]?.count ?? 0;
}

/** 본문 저장 포맷. `posts.content_format` 의 값과 같다 (DATABASE.md §1.1). */
export type ContentFormat = "MARKDOWN" | "PLAIN";

/**
 * 새 글의 기본 모드. 서식이 필요 없는 사용자가 다수라 평문을 기본으로 둔다
 * (PRD Principle 3 — Low Friction). DB 컬럼 default 는 기존 글 백필 때문에 'MARKDOWN' 이다.
 */
export const DEFAULT_CONTENT_FORMAT: ContentFormat = "PLAIN";

/**
 * DB에서 읽은 값을 ContentFormat 으로 좁힌다. 알 수 없는 값은 Markdown 으로 폴백한다 —
 * content_format 컬럼이 없던 시절 글의 렌더 동작과 같아야 한다.
 */
export function toContentFormat(value: unknown): ContentFormat {
  return value === "PLAIN" ? "PLAIN" : "MARKDOWN";
}
