import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LINK_PREVIEW_SELECT, normalizeUrl, type LinkPreview } from "@/lib/og";

const CACHE_TTL_DAYS = 7;
const PARSER_TIMEOUT_MS = 8000;

interface ParserResponse {
  title: string | null;
  description: string | null;
  image_url: string | null;
}

/** fetched_at이 TTL을 넘겼는지 판단한다. 렌더 중이 아니므로 Date.now()를 직접 써도 된다. */
function isStale(fetchedAt: string): boolean {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export async function POST(request: Request) {
  // 로그인한 사용자만 외부 파서를 돌릴 수 있다.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rawUrl = (body as { url?: unknown })?.url;
  if (typeof rawUrl !== "string") {
    return Response.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  const url = normalizeUrl(rawUrl);
  if (!url) {
    return Response.json({ error: "지원하지 않는 URL입니다." }, { status: 400 });
  }

  // 1) 캐시 조회 — 7일 이내면 파서를 호출하지 않는다 (ARCHITECTURE.md §4).
  const { data: cached } = await supabase
    .from("link_previews")
    .select(`${LINK_PREVIEW_SELECT}, fetched_at`)
    .eq("url", url)
    .maybeSingle();

  if (cached && !isStale(cached.fetched_at as string)) {
    return Response.json({
      url: cached.url,
      og_title: cached.og_title,
      og_description: cached.og_description,
      og_image_url: cached.og_image_url,
      cached: true,
    } satisfies LinkPreview & { cached: boolean });
  }

  // 2) 파서 호출
  const parserUrl = process.env.OG_PARSER_URL;
  const parserKey = process.env.OG_PARSER_API_KEY;
  if (!parserUrl || !parserKey) {
    return Response.json({ error: "OG 파서가 설정되지 않았습니다." }, { status: 503 });
  }

  let parsed: ParserResponse;
  try {
    const response = await fetch(`${parserUrl.replace(/\/$/, "")}/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": parserKey,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(PARSER_TIMEOUT_MS),
    });

    if (!response.ok) {
      // 파싱 불가(내부망 URL, HTML 아님 등)는 오류가 아니라 "미리보기 없음"으로 다룬다.
      return Response.json({ error: "미리보기를 만들 수 없습니다." }, { status: 422 });
    }

    parsed = (await response.json()) as ParserResponse;
  } catch {
    return Response.json({ error: "미리보기를 만들 수 없습니다." }, { status: 422 });
  }

  // 카드로 만들 만한 내용이 있어야 캐시에 담는다.
  // 제목만 있는 경우는 OG 태그 없이 <title>만 주워온 것이므로(예: example.com)
  // 카드 대신 일반 링크로 두는 편이 낫다.
  const hasUsablePreview =
    Boolean(parsed.title) && Boolean(parsed.description || parsed.image_url);
  if (!hasUsablePreview) {
    return Response.json({ error: "미리보기 정보가 없습니다." }, { status: 422 });
  }

  // 3) service_role로 upsert (link_previews는 쓰기 정책이 없다).
  const admin = createAdminClient();
  const { data: saved, error: upsertError } = await admin
    .from("link_previews")
    .upsert(
      {
        url,
        og_title: parsed.title,
        og_description: parsed.description,
        og_image_url: parsed.image_url,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    )
    .select(LINK_PREVIEW_SELECT)
    .single();

  if (upsertError || !saved) {
    return Response.json({ error: "미리보기 저장에 실패했습니다." }, { status: 500 });
  }

  return Response.json({ ...saved, cached: false });
}
