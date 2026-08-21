import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PostBody from "@/components/PostBody";
import LikeButton from "@/components/LikeButton";
import DeletePostButton from "@/components/DeletePostButton";
import CommentSection from "@/components/CommentSection";
import { COMMENT_SELECT, type CommentNode } from "@/lib/comments";
import { formatRelativeTime } from "@/lib/format";
import { toContentFormat } from "@/lib/posts";
import {
  LINK_PREVIEW_SELECT,
  extractStandaloneUrls,
  toPreviewMap,
  type LinkPreview,
} from "@/lib/og";

interface PostDetail {
  id: string;
  title: string;
  content: string;
  content_format: string;
  status: string;
  author_id: string;
  created_at: string;
  view_count: number;
  like_count: number;
  profiles: { nickname: string } | null;
}

/**
 * generateMetadata와 페이지 본문이 같은 글을 각각 읽으면 요청마다 DB 왕복이 두 번 난다.
 * cache()로 감싸 한 요청 안에서는 한 번만 조회한다.
 */
const getPost = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      "id, title, content, content_format, status, author_id, created_at, view_count, like_count, profiles(nickname)",
    )
    .eq("id", id)
    .maybeSingle<PostDetail>();
  return data;
});

export async function generateMetadata(
  props: PageProps<"/posts/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const post = await getPost(id);

  if (!post || post.status !== "PUBLISHED") {
    return { title: "찾을 수 없는 글" };
  }

  // 본문 앞부분을 설명으로 쓴다. 마크다운 기호 제거는 마크다운 글에만 한다 —
  // 평문 글에서는 그 기호가 사용자가 실제로 쓴 문자다.
  const body =
    toContentFormat(post.content_format) === "MARKDOWN"
      ? post.content.replace(/[#*`>[\]()!_-]/g, " ")
      : post.content;
  const description = body.replace(/\s+/g, " ").trim().slice(0, 120);

  return {
    title: post.title,
    description: description || undefined,
    openGraph: {
      title: post.title,
      description: description || undefined,
      type: "article",
    },
  };
}

export default async function PostDetailPage(props: PageProps<"/posts/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  // 사용자 조회와 글 조회는 서로를 기다릴 필요가 없다.
  const [
    {
      data: { user },
    },
    post,
  ] = await Promise.all([supabase.auth.getUser(), getPost(id)]);

  if (!post || post.status === "DELETED") {
    notFound();
  }

  const isOwner = user?.id === post.author_id;

  if (post.status === "DRAFT" && !isOwner) {
    notFound();
  }

  // 본문의 단독 줄 URL은 이미 작성 시점에 파싱되어 캐시에 있다.
  // 여기서는 DB만 읽는다 — 조회 시 파서를 호출하지 않는다 (ARCHITECTURE.md §4).
  const standaloneUrls = extractStandaloneUrls(post.content);

  // 조회수 증가, 내 추천 여부, 링크 미리보기, 댓글은 서로 독립이다.
  // DB가 다른 대륙에 있어 순차로 돌리면 왕복 지연이 그대로 쌓인다.
  const [, likeRowResult, previewResult, commentsResult] = await Promise.all([
    supabase.rpc("increment_view_count", { p_post_id: post.id }),
    user
      ? supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", post.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : null,
    standaloneUrls.length > 0
      ? supabase
          .from("link_previews")
          .select(LINK_PREVIEW_SELECT)
          .in("url", standaloneUrls)
          .returns<LinkPreview[]>()
      : null,
    supabase
      .from("comments")
      .select(COMMENT_SELECT)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .returns<CommentNode[]>(),
  ]);

  const initialLiked = Boolean(likeRowResult?.data);
  const previews = toPreviewMap(previewResult?.data);
  const comments = commentsResult.data;

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
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
          <span>{post.profiles?.nickname ?? "알 수 없음"}</span>
          <span>·</span>
          <span>{formatRelativeTime(post.created_at)}</span>
          <span>·</span>
          <span>조회 {post.view_count}</span>
        </div>
      </div>

      <PostBody
        content={post.content}
        format={toContentFormat(post.content_format)}
        previews={previews}
      />

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
