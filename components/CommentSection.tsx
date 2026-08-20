"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CommentItem from "@/components/CommentItem";

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

interface CommentSectionProps {
  postId: string;
  currentUserId: string | null;
  initialComments: CommentNode[];
  initialLikedCommentIds: string[];
}

export default function CommentSection({
  postId,
  currentUserId,
  initialComments,
  initialLikedCommentIds,
}: CommentSectionProps) {
  const router = useRouter();
  const [comments, setComments] = useState<CommentNode[]>(initialComments);
  const [likedIds, setLikedIds] = useState<Set<string>>(
    () => new Set(initialLikedCommentIds),
  );
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Realtime: 지금 보고 있는 글의 댓글 INSERT만 구독한다.
  // 범위를 넓히지 않는다 (ARCHITECTURE.md §4) — UPDATE/DELETE는 구독하지 않는다.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          const inserted = payload.new as { id: string };

          // postgres_changes 페이로드에는 조인된 닉네임이 없으므로 해당 행만 다시 읽는다.
          const { data } = await supabase
            .from("comments")
            .select(
              "id, post_id, author_id, parent_id, content, like_count, created_at, deleted_at, profiles(nickname)",
            )
            .eq("id", inserted.id)
            .single<CommentNode>();

          if (!data) return;

          // 내가 쓴 댓글은 이미 낙관적으로 넣었으므로 중복을 막는다.
          setComments((prev) =>
            prev.some((c) => c.id === data.id) ? prev : [...prev, data],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  // 원댓글은 created_at ASC, 대댓글은 부모 바로 아래에 붙인다.
  // Realtime으로 도착한 댓글이 순서에 맞게 끼도록 항상 created_at으로 정렬한다.
  const threads = useMemo(() => {
    const sorted = [...comments].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const roots = sorted.filter((c) => !c.parent_id);
    const repliesByParent = new Map<string, CommentNode[]>();

    for (const comment of sorted) {
      if (!comment.parent_id) continue;
      const list = repliesByParent.get(comment.parent_id) ?? [];
      list.push(comment);
      repliesByParent.set(comment.parent_id, list);
    }

    return roots
      .map((root) => ({
        root,
        // 삭제된 대댓글은 화면에서 제거한다 (자리 유지 대상이 아니다).
        replies: (repliesByParent.get(root.id) ?? []).filter((r) => !r.deleted_at),
      }))
      // 삭제된 원댓글은 살아있는 대댓글이 있을 때만 "삭제된 댓글입니다"로 자리를 유지한다.
      .filter(({ root, replies }) => !root.deleted_at || replies.length > 0);
  }, [comments]);

  const visibleCount = threads.reduce(
    (sum, { root, replies }) => sum + (root.deleted_at ? 0 : 1) + replies.length,
    0,
  );

  async function insertComment(content: string, parentId: string | null) {
    if (!currentUserId) {
      router.push("/login");
      return false;
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) return false;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, content: trimmed, parent_id: parentId })
      .select(
        "id, post_id, author_id, parent_id, content, like_count, created_at, deleted_at, profiles(nickname)",
      )
      .single<CommentNode>();

    if (error || !data) return false;

    setComments((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
    return true;
  }

  async function handleSubmitNew() {
    setSubmitting(true);
    const ok = await insertComment(newContent, null);
    setSubmitting(false);
    if (ok) setNewContent("");
  }

  async function handleUpdate(commentId: string, content: string) {
    const trimmed = content.trim();
    if (trimmed.length === 0) return false;

    const supabase = createClient();
    const { error } = await supabase
      .from("comments")
      .update({ content: trimmed })
      .eq("id", commentId);

    if (error) return false;

    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, content: trimmed } : c)),
    );
    return true;
  }

  async function handleDelete(commentId: string) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;

    const deletedAt = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase
      .from("comments")
      .update({ deleted_at: deletedAt })
      .eq("id", commentId);

    if (error) return;

    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, deleted_at: deletedAt } : c)),
    );
  }

  async function handleToggleLike(commentId: string, liked: boolean) {
    if (!currentUserId) {
      router.push("/login");
      return;
    }

    const supabase = createClient();

    if (liked) {
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", currentUserId);
      if (error) return;

      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, like_count: c.like_count - 1 } : c,
        ),
      );
      return;
    }

    const { error } = await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId });
    if (error) return;

    setLikedIds((prev) => new Set(prev).add(commentId));
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, like_count: c.like_count + 1 } : c)),
    );
  }

  return (
    <section className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10">
      <h2 className="text-sm font-semibold">댓글 {visibleCount}</h2>

      <div>
        {threads.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
            첫 댓글을 남겨보세요.
          </p>
        ) : (
          threads.map(({ root, replies }) => (
            <div key={root.id}>
              <CommentItem
                comment={root}
                currentUserId={currentUserId}
                isReply={false}
                liked={likedIds.has(root.id)}
                onToggleLike={handleToggleLike}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onReply={(parentId, content) => insertComment(content, parentId)}
              />
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  isReply
                  liked={likedIds.has(reply.id)}
                  onToggleLike={handleToggleLike}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={3}
          placeholder={currentUserId ? "댓글을 입력하세요" : "로그인 후 댓글을 남길 수 있습니다"}
          className="rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
        />
        <button
          onClick={handleSubmitNew}
          disabled={submitting || newContent.trim().length === 0}
          className="self-start rounded bg-foreground px-4 py-1.5 text-sm text-background disabled:opacity-50"
        >
          댓글 등록
        </button>
      </div>
    </section>
  );
}
