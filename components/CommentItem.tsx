"use client";

import { useState } from "react";
import { formatRelativeTime } from "@/lib/format";
import type { CommentNode } from "@/lib/comments";

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
        <p className="text-sm text-muted">삭제된 댓글입니다.</p>
      </div>
    );
  }

  /** 연타로 요청이 겹치지 않게 감싼다. 진행 중이면 무시한다. */
  async function runPending<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (pending) return undefined;
    setPending(true);
    try {
      return await action();
    } finally {
      setPending(false);
    }
  }

  async function handleSaveEdit() {
    const ok = await runPending(() => onUpdate(comment.id, editContent));
    if (ok) setEditing(false);
  }

  async function handleSubmitReply() {
    if (!onReply) return;
    const ok = await runPending(() => onReply(comment.id, replyContent));
    if (ok) {
      setReplyContent("");
      setReplying(false);
    }
  }

  return (
    <div className={`border-b border-black/5 py-2 dark:border-white/5 ${indentClass}`}>
      <div className="flex flex-wrap gap-x-2 text-xs text-muted">
        <span className="font-medium text-strong">
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
            onClick={() => runPending(() => onToggleLike(comment.id, liked))}
            disabled={pending}
            className={`disabled:opacity-50 ${
              liked ? "text-danger" : "text-muted"
            }`}
          >
            추천 {comment.like_count}
          </button>
          {!isReply && onReply && (
            <button
              onClick={() => setReplying((v) => !v)}
              className="text-muted"
            >
              답글
            </button>
          )}
          {isOwner && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-muted"
              >
                수정
              </button>
              <button
                onClick={() => runPending(() => onDelete(comment.id))}
                disabled={pending}
                className="text-danger disabled:opacity-50"
              >
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
