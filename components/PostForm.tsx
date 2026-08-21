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
import PostBody from "@/components/PostBody";
import ImageUploadButton, { type UploadedImage } from "@/components/ImageUploadButton";
import {
  LINK_PREVIEW_SELECT,
  extractStandaloneUrls,
  toPreviewMap,
  type LinkPreview,
} from "@/lib/og";
import {
  DEFAULT_CONTENT_FORMAT,
  isContentFormat,
  type ContentFormat,
} from "@/lib/posts";

type PostFormProps =
  | { mode: "create"; boardId: string }
  | {
      mode: "edit";
      postId: string;
      initialTitle: string;
      initialContent: string;
      initialFormat: ContentFormat;
      initialStatus: string;
    };

interface DraftSnapshot {
  title: string;
  content: string;
  /** 컬럼이 없던 시절의 임시본에는 없다 — 복원 시 현재 모드를 유지한다. */
  format?: ContentFormat;
  savedAt: string;
}

const AUTOSAVE_DELAY_MS = 5000;
/** 마지막에 고른 작성 모드. 같은 사람은 대체로 같은 모드로 계속 쓴다. */
const FORMAT_STORAGE_KEY = "w2l:content-format";

const FORMAT_OPTIONS: { value: ContentFormat; label: string }[] = [
  { value: "PLAIN", label: "일반 텍스트" },
  { value: "MARKDOWN", label: "마크다운" },
];

function draftStorageKey(props: PostFormProps): string {
  return props.mode === "create" ? "w2l:draft:new" : `w2l:draft:${props.postId}`;
}

// LocalStorage는 React 외부 저장소다. 마운트 시점에 한 번만 읽으면 되므로 구독은 비워 둔다.
const subscribeToNothing = () => () => {};
// 서버 렌더에는 LocalStorage가 없다 — 하이드레이션 후 클라이언트 값으로 교체된다.
const getNullServerSnapshot = () => null;

// 마지막에 고른 모드도 React 외부 저장소에서 읽는다 — 키가 고정이라 콜백을 모듈에 둔다.
const getStoredFormat = () => {
  try {
    return window.localStorage.getItem(FORMAT_STORAGE_KEY);
  } catch {
    return null;
  }
};

export default function PostForm(props: PostFormProps) {
  const router = useRouter();
  const storageKey = draftStorageKey(props);
  const initialTitle = props.mode === "edit" ? props.initialTitle : "";
  const initialContent = props.mode === "edit" ? props.initialContent : "";

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  // 이번 화면에서 고른 모드. null이면 저장된 마지막 모드(없으면 기본값)를 따른다.
  const [formatChoice, setFormatChoice] = useState<ContentFormat | null>(
    props.mode === "edit" ? props.initialFormat : null,
  );
  const [showFormatNotice, setShowFormatNotice] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [previews, setPreviews] = useState<Record<string, LinkPreview>>({});
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
    getNullServerSnapshot,
  );

  const storedFormat = useSyncExternalStore(
    subscribeToNothing,
    getStoredFormat,
    getNullServerSnapshot,
  );

  const format: ContentFormat =
    formatChoice ?? (isContentFormat(storedFormat) ? storedFormat : DEFAULT_CONTENT_FORMAT);

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

  /**
   * 미리보기 탭은 상세 화면과 같은 결과를 보여야 한다 — 캐시된 OG 미리보기를 읽어 온다.
   * 파서는 호출하지 않는다 (ARCHITECTURE.md §4 — 조회 시 파서 호출 금지). 그래서 아직 한 번도
   * 파싱된 적 없는 URL은 미리보기에서 링크로 보이고, 등록 후 상세에서 카드가 된다.
   */
  useEffect(() => {
    if (tab !== "preview") return;

    const urls = extractStandaloneUrls(content);
    if (urls.length === 0) return;

    let ignore = false;
    createClient()
      .from("link_previews")
      .select(LINK_PREVIEW_SELECT)
      .in("url", urls)
      .returns<LinkPreview[]>()
      .then(({ data }) => {
        if (ignore || !data || data.length === 0) return;
        setPreviews((prev) => ({ ...prev, ...toPreviewMap(data) }));
      });

    // 탭을 벗어나거나 본문이 바뀌면 뒤늦게 온 응답은 버린다.
    return () => {
      ignore = true;
    };
  }, [tab, content]);

  // 자동저장: content가 변경된 경우에만 5초 debounce (ARCHITECTURE.md §4).
  useEffect(() => {
    if (content === initialContent) return;

    const timer = setTimeout(() => {
      const snapshot: DraftSnapshot = {
        title,
        content,
        format,
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
    // format은 넣는다 — 모드가 바뀐 뒤의 임시본은 그 모드로 복원돼야 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, format, storageKey, initialContent]);

  /**
   * 모드 전환은 본문을 변환하지 않는다 — 저장 포맷이 원문이라 왕복에서 글이 손실되지 않는다.
   * 대신 평문 -> 마크다운은 이미 써둔 기호가 서식으로 해석될 수 있어 한 번 알려준다.
   */
  function changeFormat(next: ContentFormat) {
    if (next === format) return;

    setShowFormatNotice(next === "MARKDOWN" && content.trim().length > 0);
    setFormatChoice(next);

    // 기존 글 편집은 그 글의 포맷을 바꾸는 것이므로 기본값으로 기억하지 않는다.
    if (props.mode === "create") {
      try {
        window.localStorage.setItem(FORMAT_STORAGE_KEY, next);
      } catch {
        // 무시 — 기억하지 못할 뿐이다.
      }
    }
  }

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
    // 평문 모드에는 마크다운 문법을 넣지 않는다 — URL이 자기 줄을 차지하면
    // PlainText가 이미지로 렌더한다. 그래서 앞뒤 개행까지 함께 넣는다.
    const snippet =
      format === "PLAIN" ? `\n${image.publicUrl}\n` : `![](${image.publicUrl})`;

    const textarea = textareaRef.current;
    if (textarea) {
      setContent(insertAtCursor(textarea, snippet));
    } else {
      setContent((prev) => `${prev}\n${snippet.trim()}\n`);
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

  /**
   * 등록과 임시저장은 status 값과 성공 후 이동만 다르다 — 저장 흐름을 한곳에 둔다.
   * DRAFT를 수정 후 등록(PUBLISHED)하면 그대로 공개된다.
   */
  async function savePost(status: "PUBLISHED" | "DRAFT") {
    const isDraftSave = status === "DRAFT";
    const setBusy = isDraftSave ? setSavingDraft : setSubmitting;
    const failMessage = isDraftSave
      ? "임시저장에 실패했습니다. 다시 시도해주세요."
      : props.mode === "create"
        ? "글 등록에 실패했습니다. 다시 시도해주세요."
        : "글 저장에 실패했습니다. 다시 시도해주세요.";

    setError(null);
    setBusy(true);

    const supabase = createClient();
    const row = { title, content, content_format: format, status };

    let postId: string;
    if (props.mode === "create") {
      const { data, error: insertError } = await supabase
        .from("posts")
        .insert({ ...row, board_id: props.boardId })
        .select("id")
        .single();

      setBusy(false);

      if (insertError || !data) {
        setError(failMessage);
        return;
      }

      await recordPostImages(data.id, pendingImages);
      postId = data.id;
    } else {
      const { error: updateError } = await supabase
        .from("posts")
        .update(row)
        .eq("id", props.postId);

      setBusy(false);

      if (updateError) {
        setError(failMessage);
        return;
      }

      postId = props.postId;
    }

    // 임시저장 본문은 아직 공개되지 않으므로 OG 캐시를 미리 채우지 않는다.
    if (!isDraftSave) await warmLinkPreviews(content);
    clearDraft();

    if (!isDraftSave) {
      router.push(`/posts/${postId}`);
    } else if (props.mode === "create") {
      // 이후 편집은 같은 Draft를 이어서 수정하도록 편집 화면으로 옮긴다.
      router.replace(`/write/${postId}`);
    } else {
      router.refresh();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await savePost("PUBLISHED");
  }

  const isDraft = props.mode === "edit" && props.initialStatus === "DRAFT";
  const submitLabel = props.mode === "create" || isDraft ? "등록" : "수정";

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3">
      {restorable && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-warn bg-warn-bg p-2 text-xs text-strong">
          <span className="flex-1">작성 중이던 임시본이 있습니다.</span>
          <button
            type="button"
            onClick={() => {
              setTitle(restorable.title);
              setContent(restorable.content);
              // format이 없거나 알 수 없는 값인 임시본은 현재 모드를 유지한다.
              if (isContentFormat(restorable.format)) {
                setFormatChoice(restorable.format);
              }
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
          className={tab === "write" ? "font-semibold underline" : "text-muted"}
        >
          작성
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={tab === "preview" ? "font-semibold underline" : "text-muted"}
        >
          미리보기
        </button>

        <div className="ml-auto flex overflow-hidden rounded border border-black/20 text-xs dark:border-white/20">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => changeFormat(option.value)}
              aria-pressed={format === option.value}
              className={
                format === option.value
                  ? "bg-foreground px-2 py-1 text-background"
                  : "px-2 py-1 text-muted"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {showFormatNotice && (
        <p className="rounded border border-warn bg-warn-bg px-2 py-1 text-xs text-strong">
          줄바꿈이 한 문단으로 합쳐지고, 이미 쓴 기호(*, #, _ 등)가 서식으로 해석될 수
          있습니다. 미리보기로 확인해주세요.
        </p>
      )}

      {tab === "write" ? (
        <>
          {format === "MARKDOWN" ? (
            <MarkdownToolbar
              textareaRef={textareaRef}
              onChange={setContent}
              imageSlot={
                <ImageUploadButton onUploaded={handleImageUploaded} onError={setError} />
              }
            />
          ) : (
            // 평문 모드에는 문법 버튼이 필요 없다 — 이미지 첨부만 남긴다.
            <div className="flex flex-wrap items-center gap-1">
              <ImageUploadButton onUploaded={handleImageUploaded} onError={setError} />
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              format === "PLAIN" ? "내용을 입력하세요" : "내용을 마크다운으로 입력하세요"
            }
            required
            rows={16}
            className={`flex-1 resize-none rounded border border-black/20 px-3 py-2 text-sm dark:border-white/20 ${
              format === "MARKDOWN" ? "font-mono" : ""
            }`}
          />
        </>
      ) : (
        <div className="min-h-64 flex-1 overflow-y-auto rounded border border-black/20 px-3 py-2 dark:border-white/20">
          {content.trim().length > 0 ? (
            <PostBody content={content} format={format} previews={previews} />
          ) : (
            <p className="text-sm text-muted">미리볼 내용이 없습니다.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {draftSavedAt && (
        <p className="text-xs text-muted">
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
          onClick={() => savePost("DRAFT")}
          disabled={submitting || savingDraft}
          className="rounded border border-black/20 px-4 py-2 disabled:opacity-50 dark:border-white/20"
        >
          임시저장
        </button>
      </div>
    </form>
  );
}
