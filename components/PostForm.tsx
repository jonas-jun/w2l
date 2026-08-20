"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MarkdownToolbar, { insertAtCursor } from "@/components/MarkdownToolbar";
import Markdown from "@/components/Markdown";
import ImageUploadButton, { type UploadedImage } from "@/components/ImageUploadButton";
import { extractStandaloneUrls } from "@/lib/og";

type PostFormProps =
  | { mode: "create"; boardId: string }
  | {
      mode: "edit";
      postId: string;
      initialTitle: string;
      initialContent: string;
      initialStatus: string;
    };

interface DraftSnapshot {
  title: string;
  content: string;
  savedAt: string;
}

const AUTOSAVE_DELAY_MS = 5000;

function draftStorageKey(props: PostFormProps): string {
  return props.mode === "create" ? "w2l:draft:new" : `w2l:draft:${props.postId}`;
}

// LocalStorage는 React 외부 저장소다. 마운트 시점에 한 번만 읽으면 되므로 구독은 비워 둔다.
const subscribeToNothing = () => () => {};
// 서버 렌더에는 LocalStorage가 없다 — 하이드레이션 후 클라이언트 값으로 교체된다.
const getServerDraftSnapshot = () => null;

export default function PostForm(props: PostFormProps) {
  const router = useRouter();
  const storageKey = draftStorageKey(props);
  const initialTitle = props.mode === "edit" ? props.initialTitle : "";
  const initialContent = props.mode === "edit" ? props.initialContent : "";

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  // 새 글은 아직 post_id가 없다 — 글이 만들어진 뒤에 post_images 행을 기록한다.
  const [pendingImages, setPendingImages] = useState<UploadedImage[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 재진입 시 LocalStorage 임시본을 읽는다. 문자열 그대로 받아야 스냅샷이 안정적이다.
  const getDraftSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, [storageKey]);

  const rawDraft = useSyncExternalStore(
    subscribeToNothing,
    getDraftSnapshot,
    getServerDraftSnapshot,
  );

  // 저장된 임시본이 현재 내용과 다를 때만 복원 배너를 띄운다.
  const restorable = useMemo<DraftSnapshot | null>(() => {
    if (draftDismissed || !rawDraft) return null;
    try {
      const snapshot = JSON.parse(rawDraft) as DraftSnapshot;
      if (snapshot.content !== initialContent || snapshot.title !== initialTitle) {
        return snapshot;
      }
    } catch {
      // 손상된 임시본은 무시한다.
    }
    return null;
  }, [rawDraft, draftDismissed, initialContent, initialTitle]);

  // 자동저장: content가 변경된 경우에만 5초 debounce (ARCHITECTURE.md §4).
  useEffect(() => {
    if (content === initialContent) return;

    const timer = setTimeout(() => {
      const snapshot: DraftSnapshot = {
        title,
        content,
        savedAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
        setDraftSavedAt(snapshot.savedAt);
      } catch {
        // 저장 공간 부족 등은 조용히 무시한다 — 작성 자체를 막지 않는다.
      }
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
    // title은 의존성에 넣지 않는다 — content 변경만 자동저장을 트리거한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, storageKey, initialContent]);

  /**
   * 본문의 단독 줄 URL을 작성 시점에 파싱해 캐시에 채운다 (ARCHITECTURE.md §4).
   * 실패해도 글 등록을 막지 않는다 — 미리보기가 없으면 일반 링크로 보일 뿐이다.
   */
  async function warmLinkPreviews(body: string) {
    const urls = extractStandaloneUrls(body);
    if (urls.length === 0) return;

    await Promise.allSettled(
      urls.map((url) =>
        fetch("/api/og", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }),
      ),
    );
  }

  async function recordPostImages(postId: string, images: UploadedImage[]) {
    if (images.length === 0) return;

    const supabase = createClient();
    const { count } = await supabase
      .from("post_images")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);

    const offset = count ?? 0;
    await supabase.from("post_images").insert(
      images.map((image, index) => ({
        post_id: postId,
        storage_path: image.storagePath,
        display_order: offset + index,
      })),
    );
  }

  async function handleImageUploaded(image: UploadedImage) {
    const textarea = textareaRef.current;
    if (textarea) {
      setContent(insertAtCursor(textarea, `![](${image.publicUrl})`));
    } else {
      setContent((prev) => `${prev}\n![](${image.publicUrl})\n`);
    }

    if (props.mode === "edit") {
      await recordPostImages(props.postId, [image]);
      return;
    }
    setPendingImages((prev) => [...prev, image]);
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // 무시
    }
    setDraftSavedAt(null);
  }

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

      await recordPostImages(data.id, pendingImages);
      await warmLinkPreviews(content);
      clearDraft();
      router.push(`/posts/${data.id}`);
      return;
    }

    // DRAFT를 수정 후 등록하면 그대로 공개된다.
    const { error: updateError } = await supabase
      .from("posts")
      .update({ title, content, status: "PUBLISHED" })
      .eq("id", props.postId);

    setSubmitting(false);

    if (updateError) {
      setError("글 저장에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    await warmLinkPreviews(content);
    clearDraft();
    router.push(`/posts/${props.postId}`);
  }

  async function handleSaveDraft() {
    setError(null);
    setSavingDraft(true);

    const supabase = createClient();

    if (props.mode === "create") {
      const { data, error: insertError } = await supabase
        .from("posts")
        .insert({ board_id: props.boardId, title, content, status: "DRAFT" })
        .select("id")
        .single();

      setSavingDraft(false);

      if (insertError || !data) {
        setError("임시저장에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      await recordPostImages(data.id, pendingImages);
      clearDraft();
      // 이후 편집은 같은 Draft를 이어서 수정하도록 편집 화면으로 옮긴다.
      router.replace(`/write/${data.id}`);
      return;
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update({ title, content, status: "DRAFT" })
      .eq("id", props.postId);

    setSavingDraft(false);

    if (updateError) {
      setError("임시저장에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    clearDraft();
    router.refresh();
  }

  const isDraft = props.mode === "edit" && props.initialStatus === "DRAFT";
  const submitLabel = props.mode === "create" || isDraft ? "등록" : "수정";

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3">
      {restorable && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-amber-400 bg-amber-50 p-2 text-xs dark:bg-amber-950">
          <span className="flex-1">작성 중이던 임시본이 있습니다.</span>
          <button
            type="button"
            onClick={() => {
              setTitle(restorable.title);
              setContent(restorable.content);
              setDraftDismissed(true);
            }}
            className="rounded bg-foreground px-2 py-1 text-background"
          >
            복원
          </button>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setDraftDismissed(true);
            }}
            className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
          >
            삭제
          </button>
        </div>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        required
        maxLength={200}
        className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
      />

      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setTab("write")}
          className={tab === "write" ? "font-semibold underline" : "text-zinc-500"}
        >
          작성
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={tab === "preview" ? "font-semibold underline" : "text-zinc-500"}
        >
          미리보기
        </button>
      </div>

      {tab === "write" ? (
        <>
          <MarkdownToolbar
            textareaRef={textareaRef}
            onChange={setContent}
            imageSlot={
              <ImageUploadButton onUploaded={handleImageUploaded} onError={setError} />
            }
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 마크다운으로 입력하세요"
            required
            rows={16}
            className="flex-1 resize-none rounded border border-black/20 px-3 py-2 font-mono text-sm dark:border-white/20"
          />
        </>
      ) : (
        <div className="min-h-64 flex-1 overflow-y-auto rounded border border-black/20 px-3 py-2 dark:border-white/20">
          {content.trim().length > 0 ? (
            <Markdown content={content} />
          ) : (
            <p className="text-sm text-zinc-500">미리볼 내용이 없습니다.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {draftSavedAt && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          임시본이 이 브라우저에 저장되었습니다.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || savingDraft}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={submitting || savingDraft}
          className="rounded border border-black/20 px-4 py-2 disabled:opacity-50 dark:border-white/20"
        >
          임시저장
        </button>
      </div>
    </form>
  );
}
