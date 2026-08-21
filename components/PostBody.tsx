import Markdown from "@/components/Markdown";
import PlainText from "@/components/PlainText";
import type { LinkPreview } from "@/lib/og";
import type { ContentFormat } from "@/lib/posts";

interface PostBodyProps {
  content: string;
  /** 저장된 본문의 포맷. 본문은 변환 없이 원문으로 저장하고 렌더링만 여기서 분기한다. */
  format: ContentFormat;
  previews?: Record<string, LinkPreview>;
}

/** 상세 화면과 작성 미리보기가 같은 규칙으로 본문을 그리도록 분기를 한곳에 둔다. */
export default function PostBody({ content, format, previews }: PostBodyProps) {
  if (format === "PLAIN") {
    return <PlainText content={content} previews={previews} />;
  }

  return <Markdown content={content} previews={previews} />;
}
