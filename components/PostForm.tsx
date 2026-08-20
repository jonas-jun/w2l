"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PostFormProps =
  | { mode: "create"; boardId: string }
  | { mode: "edit"; postId: string; initialTitle: string; initialContent: string };

export default function PostForm(props: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(props.mode === "edit" ? props.initialTitle : "");
  const [content, setContent] = useState(props.mode === "edit" ? props.initialContent : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();

    if (props.mode === "create") {
      const { data, error: insertError } = await supabase
        .from("posts")
        .insert({ board_id: props.boardId, title, content, status: "PUBLISHED" })
        .select("id")
        .single();

      setSubmitting(false);

      if (insertError || !data) {
        setError("글 등록에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      router.push(`/posts/${data.id}`);
      return;
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update({ title, content })
      .eq("id", props.postId);

    setSubmitting(false);

    if (updateError) {
      setError("글 수정에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    router.push(`/posts/${props.postId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        required
        maxLength={200}
        className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용을 마크다운으로 입력하세요"
        required
        rows={16}
        className="flex-1 resize-none rounded border border-black/20 px-3 py-2 font-mono text-sm dark:border-white/20"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {props.mode === "create" ? "등록" : "수정"}
      </button>
    </form>
  );
}
