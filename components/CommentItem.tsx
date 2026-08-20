"use client";

import { useState } from "react";
import { formatRelativeTime } from "@/lib/format";
import type { CommentNode } from "@/components/CommentSection";

interface CommentItemProps {
  comment: CommentNode;
  currentUserId: string | null;
  isReply: boolean;
  liked: boolean;
  onToggleLike: (commentId: string, liked: boolean) => Promise<void>;
  onUpdate: (commentId: string, content: string) => Promise<boolean>;
  onDelete: (commentId: string) => Promise<void>;
  onReply?: (parentId: string, content: string) => Promise<boolean>;
}

export default function CommentItem({
  comment,
  currentUserId,
  isReply,
  liked,
  onToggleLike,
  onUpdate,
  onDelete,
  onReply,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replying, setReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [pending, setPending] = useState(false);

  const isOwner = currentUserId === comment.author_id;
  const indentClass = isReply ? "pl-6" : "";

  if (comment.deleted_at) {
    return (
      <div className={`border-b border-black/5 py-2 dark:border-white/5 ${indentClass}`}>
        <p className="text-sm text-zinc-400">삭제된 댓글입니다.</p>
      </div>
    );
  }

  async function handleSaveEdit() {
    setPending(true);
    const ok = await onUpdate(comment.id, editContent);
    setPending(false);
    if (ok) setEditing(false);
  }

  async function handleSubmitReply() {
    if (!onReply) return;
    setPending(true);
    const ok = await onReply(comment.id, replyContent);
    setPending(false);
    if (ok) {
      setReplyContent("");
      setReplying(false);
    }
  }

  return (
    <div className={`border-b border-black/5 py-2 dark:border-white/5 ${indentClass}`}>
      <div className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {comment.profiles?.nickname ?? "알 수 없음"}
        </span>
        <span>{formatRelativeTime(comment.created_at)}</span>
      </div>

      {editing ? (
        <div className="mt-1 flex flex-col gap-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={pending || editContent.trim().length === 0}
              className="rounded bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50"
            >
              저장
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditContent(comment.content);
              }}
              className="rounded border border-black/20 px-3 py-1 text-xs dark:border-white/20"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
      )}

      {!editing && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => onToggleLike(comment.id, liked)}
            className={liked ? "text-red-600" : "text-zinc-500 dark:text-zinc-400"}
          >
            추천 {comment.like_count}
          </button>
          {!isReply && onReply && (
            <button
              onClick={() => setReplying((v) => !v)}
              className="text-zinc-500 dark:text-zinc-400"
            >
              답글
            </button>
          )}
          {isOwner && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-zinc-500 dark:text-zinc-400"
              >
                수정
              </button>
              <button onClick={() => onDelete(comment.id)} className="text-red-600">
                삭제
              </button>
            </>
          )}
        </div>
      )}

      {replying && (
        <div className="mt-2 flex flex-col gap-2 pl-6">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={2}
            placeholder="답글을 입력하세요"
            className="rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
          />
          <button
            onClick={handleSubmitReply}
            disabled={pending || replyContent.trim().length === 0}
            className="self-start rounded bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50"
          >
            답글 등록
          </button>
        </div>
      )}
    </div>
  );
}
