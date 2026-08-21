import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";
import { commentCountOf, type PostListRow } from "@/lib/posts";

export default function PostCard({ post }: { post: PostListRow }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      prefetch={false}
      className="flex flex-col gap-1 border-b border-border/40 py-3"
    >
      <p className="font-medium">{post.title}</p>
      <div className="flex flex-wrap gap-x-2 text-xs text-muted">
        <span>{post.profiles?.nickname ?? "알 수 없음"}</span>
        <span>·</span>
        <span>{formatRelativeTime(post.created_at)}</span>
        <span>·</span>
        <span>추천 {post.like_count}</span>
        <span>·</span>
        <span>댓글 {commentCountOf(post)}</span>
        <span>·</span>
        <span>조회 {post.view_count}</span>
      </div>
    </Link>
  );
}
