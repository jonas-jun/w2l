import type { LinkPreview } from "@/lib/og";

export default function OgCard({ preview }: { preview: LinkPreview }) {
  let hostname = preview.url;
  try {
    hostname = new URL(preview.url).hostname;
  } catch {
    // 정규화를 거친 URL이라 실패할 일은 없지만, 실패해도 원문을 보여준다.
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-2 flex overflow-hidden rounded border border-black/15 no-underline dark:border-white/15"
    >
      {preview.og_image_url && (
        // 외부 도메인 이미지라 next/image 대신 img를 쓴다 (도메인 화이트리스트 불필요).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.og_image_url}
          alt=""
          className="h-24 w-24 shrink-0 object-cover"
          loading="lazy"
        />
      )}
      <div className="flex min-w-0 flex-col justify-center gap-1 p-3">
        {preview.og_title && (
          <p className="line-clamp-2 text-sm font-medium text-[var(--foreground)]">
            {preview.og_title}
          </p>
        )}
        {preview.og_description && (
          <p className="line-clamp-2 text-xs text-muted">
            {preview.og_description}
          </p>
        )}
        <p className="truncate text-xs text-muted">{hostname}</p>
      </div>
    </a>
  );
}
