import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Markdown from "@/components/Markdown";
import LikeButton from "@/components/LikeButton";
import DeletePostButton from "@/components/DeletePostButton";
import CommentSection, { type CommentNode } from "@/components/CommentSection";
import { formatRelativeTime } from "@/lib/format";
import { extractStandaloneUrls, type LinkPreview } from "@/lib/og";

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

export async function generateMetadata(
  props: PageProps<"/posts/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("title, content, status")
    .eq("id", id)
    .maybeSingle();

  if (!post || post.status !== "PUBLISHED") {
    return { title: "찾을 수 없는 글" };
  }

  // 본문 앞부분을 설명으로 쓴다 (마크다운 기호는 대충 걷어낸다).
  const description = (post.content as string)
    .replace(/[#*`>[\]()!_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return {
    title: post.title as string,
    description: description || undefined,
    openGraph: {
      title: post.title as string,
      description: description || undefined,
      type: "article",
    },
  };
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

  let initialLiked = false;
  if (user) {
    const { data: likeRow } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .maybeSingle();
    initialLiked = Boolean(likeRow);
  }

  // 본문의 단독 줄 URL은 이미 작성 시점에 파싱되어 캐시에 있다.
  // 여기서는 DB만 읽는다 — 조회 시 파서를 호출하지 않는다 (ARCHITECTURE.md §4).
  const standaloneUrls = extractStandaloneUrls(post.content);
  const previews: Record<string, LinkPreview> = {};
  if (standaloneUrls.length > 0) {
    const { data: previewRows } = await supabase
      .from("link_previews")
      .select("url, og_title, og_description, og_image_url")
      .in("url", standaloneUrls)
      .returns<LinkPreview[]>();

    for (const row of previewRows ?? []) {
      previews[row.url] = row;
    }
  }

  const { data: comments } = await supabase
    .from("comments")
    .select(
      "id, post_id, author_id, parent_id, content, like_count, created_at, deleted_at, profiles(nickname)",
    )
    .eq("post_id", post.id)
    .order("created_at", { ascending: true })
    .returns<CommentNode[]>();

  let likedCommentIds: string[] = [];
  if (user && comments && comments.length > 0) {
    const { data: commentLikes } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", user.id)
      .in(
        "comment_id",
        comments.map((c) => c.id),
      );
    likedCommentIds = commentLikes?.map((row) => row.comment_id as string) ?? [];
  }

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

      <Markdown content={post.content} previews={previews} />

      <div className="flex items-center gap-3">
        <LikeButton
          postId={post.id}
          initialLikeCount={post.like_count}
          initialLiked={initialLiked}
          userId={user?.id ?? null}
        />
      </div>

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

      <CommentSection
        postId={post.id}
        currentUserId={user?.id ?? null}
        initialComments={comments ?? []}
        initialLikedCommentIds={likedCommentIds}
      />
    </main>
  );
}
