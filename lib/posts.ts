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
