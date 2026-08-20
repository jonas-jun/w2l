import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Markdown from "@/components/Markdown";
import DeletePostButton from "@/components/DeletePostButton";
import { formatRelativeTime } from "@/lib/format";

interface PostDetail {
  id: string;
  title: string;
  content: string;
  status: string;
  author_id: string;
  created_at: string;
  view_count: number;
  like_count: number;
  profiles: { nickname: string } | null;
}

export default async function PostDetailPage(props: PageProps<"/posts/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, title, content, status, author_id, created_at, view_count, like_count, profiles(nickname)",
    )
    .eq("id", id)
    .maybeSingle<PostDetail>();

  if (!post || post.status === "DELETED") {
    notFound();
  }

  const isOwner = user?.id === post.author_id;

  if (post.status === "DRAFT" && !isOwner) {
    notFound();
  }

  await supabase.rpc("increment_view_count", { p_post_id: post.id });

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">{post.title}</h1>
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{post.profiles?.nickname ?? "알 수 없음"}</span>
          <span>·</span>
          <span>{formatRelativeTime(post.created_at)}</span>
          <span>·</span>
          <span>조회 {post.view_count}</span>
        </div>
      </div>

      <Markdown content={post.content} />

      {isOwner && (
        <div className="flex gap-2 border-t border-black/10 pt-3 dark:border-white/10">
          <Link
            href={`/write/${post.id}`}
            className="rounded border border-black/20 px-3 py-1.5 text-sm dark:border-white/20"
          >
            수정
          </Link>
          <DeletePostButton postId={post.id} />
        </div>
      )}
    </main>
  );
}
