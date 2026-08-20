import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

interface PostCardProps {
  id: string;
  title: string;
  nickname: string;
  createdAt: string;
  likeCount: number;
  viewCount: number;
}

export default function PostCard({
  id,
  title,
  nickname,
  createdAt,
  likeCount,
  viewCount,
}: PostCardProps) {
  return (
    <Link
      href={`/posts/${id}`}
      prefetch={false}
      className="flex flex-col gap-1 border-b border-black/10 py-3 dark:border-white/10"
    >
      <p className="font-medium">{title}</p>
      <div className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{nickname}</span>
        <span>·</span>
        <span>{formatRelativeTime(createdAt)}</span>
        <span>·</span>
        <span>추천 {likeCount}</span>
        <span>·</span>
        <span>조회 {viewCount}</span>
      </div>
    </Link>
  );
}
