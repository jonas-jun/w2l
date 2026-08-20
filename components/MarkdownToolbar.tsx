"use client";

import type { ReactNode, RefObject } from "react";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (nextValue: string) => void;
  /** 이미지 업로드 버튼 자리 — T4.2에서 실제 업로드 버튼을 넣는다. */
  imageSlot?: ReactNode;
}

/**
 * 선택 영역을 prefix/suffix로 감싼다. 선택이 없으면 placeholder를 넣고
 * 그 부분을 선택 상태로 만들어 바로 덮어쓸 수 있게 한다.
 */
export function wrapSelection(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string,
  placeholder: string,
): string {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd) || placeholder;
  const next = value.slice(0, selectionStart) + prefix + selected + suffix + value.slice(selectionEnd);

  // React state 반영 후 커서를 삽입한 텍스트 위로 옮긴다.
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(selectionStart + prefix.length, selectionStart + prefix.length + selected.length);
  });

  return next;
}

/** 커서 위치에 텍스트를 끼워 넣고, 커서를 삽입한 텍스트 뒤로 옮긴다. */
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): string {
  const { selectionStart, selectionEnd, value } = textarea;
  const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd);

  requestAnimationFrame(() => {
    textarea.focus();
    const caret = selectionStart + text.length;
    textarea.setSelectionRange(caret, caret);
  });

  return next;
}

export default function MarkdownToolbar({
  textareaRef,
  onChange,
  imageSlot,
}: MarkdownToolbarProps) {
  function apply(prefix: string, suffix: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    onChange(wrapSelection(textarea, prefix, suffix, placeholder));
  }

  const buttonClass =
    "rounded border border-black/20 px-2 py-1 text-xs dark:border-white/20";

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => apply("**", "**", "굵게")}
        className={`${buttonClass} font-bold`}
        aria-label="굵게"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => apply("[", "](https://)", "링크")}
        className={buttonClass}
        aria-label="링크"
      >
        링크
      </button>
      {imageSlot}
    </div>
  );
}
