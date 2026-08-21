import type { ReactNode } from "react";
import OgCard from "@/components/OgCard";
import { isImageUrl, normalizeUrl, type LinkPreview } from "@/lib/og";

interface PlainTextProps {
  content: string;
  /** 정규화된 URL -> 미리보기. 단독 줄 URL을 OG 카드로 치환할 때 쓴다. */
  previews?: Record<string, LinkPreview>;
}

/**
 * 평문 본문은 줄바꿈이 곧 의미다. 마크다운처럼 단일 개행을 접지 않고 pre-wrap으로 그대로 두되,
 * 이미지·OG 카드는 텍스트 흐름에서 떼어낸 블록으로 렌더한다.
 */
type Block =
  | { kind: "text"; value: string }
  | { kind: "image"; url: string }
  | { kind: "preview"; preview: LinkPreview };

const STANDALONE_URL_PATTERN = /^https?:\/\/\S+$/;
const INLINE_URL_PATTERN = /https?:\/\/\S+/g;
// 문장 끝에 붙은 기호는 URL의 일부가 아니다 — 링크에서 떼어 텍스트로 남긴다.
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?)\]}'"]+$/;

function splitBlocks(
  content: string,
  previews?: Record<string, LinkPreview>,
): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];

  function flushText() {
    // 블록 경계의 빈 줄은 카드·이미지 자체 여백과 겹치므로 잘라낸다.
    const value = buffer.join("\n").replace(/^\n+|\n+$/g, "");
    buffer = [];
    if (value.length > 0) blocks.push({ kind: "text", value });
  }

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (STANDALONE_URL_PATTERN.test(line)) {
      if (isImageUrl(line)) {
        flushText();
        blocks.push({ kind: "image", url: line });
        continue;
      }

      const normalized = normalizeUrl(line);
      const preview = normalized ? previews?.[normalized] : undefined;
      if (preview) {
        flushText();
        blocks.push({ kind: "preview", preview });
        continue;
      }
      // 미리보기가 없는 URL은 본문 흐름에 그대로 남긴다 — linkify가 일반 링크로 만든다.
    }

    buffer.push(rawLine);
  }

  flushText();
  return blocks;
}

/**
 * 문장 속 URL을 링크로 만든다. 나머지 텍스트는 React가 이스케이프하므로
 * HTML을 직접 삽입(dangerouslySetInnerHTML)하지 않는다.
 */
function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_URL_PATTERN)) {
    const start = match.index;
    const url = match[0].replace(TRAILING_PUNCTUATION_PATTERN, "");

    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <a key={start} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>,
    );
    cursor = start + url.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export default function PlainText({ content, previews }: PlainTextProps) {
  // 본문 타이포그래피(여백·링크색·이미지 크기)는 마크다운 본문과 같아야 하므로
  // 같은 .post-body 스타일을 쓴다.
  return (
    <div className="post-body text-sm leading-relaxed">
      {splitBlocks(content, previews).map((block, index) => {
        if (block.kind === "image") {
          // Storage 이미지라 도메인이 고정이지만, OgCard와 같은 이유로 next/image 대신 img를 쓴다.
          // eslint-disable-next-line @next/next/no-img-element
          return <img key={index} src={block.url} alt="" loading="lazy" />;
        }

        if (block.kind === "preview") {
          return <OgCard key={index} preview={block.preview} />;
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {linkify(block.value)}
          </p>
        );
      })}
    </div>
  );
}
