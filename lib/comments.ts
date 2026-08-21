/** 상세 화면·댓글 섹션에서 함께 쓰는 댓글 행. */
export interface CommentNode {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  created_at: string;
  deleted_at: string | null;
  profiles: { nickname: string } | null;
}

/** 댓글 조회용 select. 목록·Realtime 재조회·insert 반환이 같은 모양이어야 한다. */
export const COMMENT_SELECT =
  "id, post_id, author_id, parent_id, content, like_count, created_at, deleted_at, profiles(nickname)";
