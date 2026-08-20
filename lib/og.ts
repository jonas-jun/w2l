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
 * 본문에서 "단독 줄 URL"만 뽑는다. 문장 중간의 링크나 마크다운 링크는 대상이 아니다
 * (ARCHITECTURE.md §4 — 작성 시점에만 파싱한다).
 */
export function extractStandaloneUrls(content: string): string[] {
  const urls = new Set<string>();

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!/^https?:\/\/\S+$/.test(line)) continue;

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
