/** 추적용 쿼리 파라미터 — 같은 문서를 다른 URL로 캐시하지 않도록 제거한다. */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
];

/**
 * 캐시 키로 쓸 URL을 정규화한다.
 * 정규화할 수 없으면(잘못된 URL, http(s)가 아님) null을 돌려준다.
 */
export function normalizeUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  for (const param of TRACKING_PARAMS) {
    parsed.searchParams.delete(param);
  }

  // 기본 포트는 URL 객체가 알아서 지운다. 빈 경로의 끝 슬래시만 정리한다.
  let normalized = parsed.toString();
  if (parsed.pathname === "/" && !parsed.search) {
    normalized = normalized.replace(/\/$/, "");
  }

  return normalized;
}

/**
 * Storage 에 올린 이미지는 항상 확장자로 끝나는 경로다 (ImageUploadButton).
 * 확장자만으로 이미지 URL 을 판정한다 — HEAD 요청 같은 왕복 없이 충분하다.
 */
const IMAGE_PATH_PATTERN = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** URL 이 이미지를 가리키는가. 평문 본문의 이미지 줄 판정과 OG 파싱 제외에 함께 쓴다. */
export function isImageUrl(raw: string): boolean {
  try {
    return IMAGE_PATH_PATTERN.test(new URL(raw).pathname);
  } catch {
    return false;
  }
}

/**
 * 본문에서 "단독 줄 URL"만 뽑는다. 문장 중간의 링크나 마크다운 링크는 대상이 아니다
 * (ARCHITECTURE.md §4 — 작성 시점에만 파싱한다).
 */
export function extractStandaloneUrls(content: string): string[] {
  const urls = new Set<string>();

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!/^https?:\/\/\S+$/.test(line)) continue;
    // 이미지 URL 은 OG 대상이 아니다. 평문 모드는 이미지를 URL 단독 줄로 넣으므로
    // 걸러 두지 않으면 업로드마다 파서를 헛호출한다.
    if (isImageUrl(line)) continue;

    const normalized = normalizeUrl(line);
    if (normalized) urls.add(normalized);
  }

  return [...urls];
}

export interface LinkPreview {
  url: string;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
}

/** link_previews 조회용 select. LinkPreview 인터페이스와 모양이 같아야 한다. */
export const LINK_PREVIEW_SELECT = "url, og_title, og_description, og_image_url";

/** 조회한 미리보기 행들을 "정규화된 URL -> 미리보기" 맵으로 만든다. */
export function toPreviewMap(
  rows: LinkPreview[] | null | undefined,
): Record<string, LinkPreview> {
  const previews: Record<string, LinkPreview> = {};
  for (const row of rows ?? []) previews[row.url] = row;
  return previews;
}
