import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import OgCard from "@/components/OgCard";
import { normalizeUrl, type LinkPreview } from "@/lib/og";

interface MarkdownProps {
  content: string;
  /** 정규화된 URL -> 미리보기. 단독 줄 URL을 OG 카드로 치환할 때 쓴다. */
  previews?: Record<string, LinkPreview>;
}

/** 노드가 "단독 줄 URL"(= 텍스트와 href가 같은 링크 하나)이면 그 URL을 돌려준다. */
function standaloneUrlOf(children: ReactNode): string | null {
  const nodes = Children.toArray(children).filter(
    (child) => typeof child !== "string" || child.trim().length > 0,
  );

  if (nodes.length !== 1) return null;

  const [node] = nodes;

  // remark-gfm의 autolink는 <a>로, 원문 그대로면 문자열로 들어온다.
  if (typeof node === "string") {
    return /^https?:\/\/\S+$/.test(node.trim()) ? node.trim() : null;
  }

  if (!isValidElement(node)) return null;

  const props = node.props as { href?: unknown; children?: ReactNode };
  if (typeof props.href !== "string") return null;

  const text = Children.toArray(props.children).join("");
  return text.trim() === props.href.trim() ? props.href : null;
}

export default function Markdown({ content, previews }: MarkdownProps) {
  return (
    <div className="markdown-body text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={
          previews
            ? {
                p({ children, ...props }) {
                  const url = standaloneUrlOf(children);
                  const normalized = url ? normalizeUrl(url) : null;
                  const preview = normalized ? previews[normalized] : undefined;

                  // 미리보기가 없는 URL은 손대지 않는다 — 일반 링크로 남는다.
                  if (!preview) return <p {...props}>{children}</p>;

                  return <OgCard preview={preview} />;
                },
              }
            : undefined
        }
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
