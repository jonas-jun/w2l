"""OG 메타데이터 파서.

외부 URL을 대신 가져오는 서비스이므로 SSRF 방어가 핵심이다 (ARCHITECTURE.md §4).
- http(s) 스킴만 허용
- DNS 해석 결과가 private/loopback/link-local 등이면 거부
- 리다이렉트는 최대 3회, 매 hop마다 주소를 다시 검사
- 타임아웃 5초, 응답 1MB 제한, text/html만 파싱
"""

import ipaddress
import os
import socket
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

MAX_REDIRECTS = 3
TIMEOUT_SECONDS = 5.0
MAX_RESPONSE_BYTES = 1024 * 1024
ALLOWED_SCHEMES = {"http", "https"}
USER_AGENT = "w2l-og-parser/1.0"

app = FastAPI(title="w2l OG parser")


class ParseRequest(BaseModel):
    url: str


class ParseResponse(BaseModel):
    title: str | None = None
    description: str | None = None
    image_url: str | None = None


class BlockedUrlError(Exception):
    """SSRF 방어 규칙에 걸린 URL."""


class FetchError(Exception):
    """가져오기 실패 — 네트워크 오류, 상태 코드, 크기/타입 제한 위반."""


def _is_blocked_ip(raw_ip: str) -> bool:
    """내부망으로 향하는 주소인지 판단한다."""
    ip = ipaddress.ip_address(raw_ip)

    # ::ffff:127.0.0.1 처럼 IPv4를 감싼 주소는 벗겨서 검사한다.
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        ip = mapped

    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _resolve_ips(host: str, port: int) -> list[str]:
    """호스트가 해석되는 모든 IP를 돌려준다. 하나라도 내부망이면 거부해야 한다."""
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise BlockedUrlError(f"호스트를 해석할 수 없습니다: {host}") from exc

    return [info[4][0] for info in infos]


def assert_url_allowed(url: str) -> None:
    """스킴과 해석된 IP를 검사한다. 리다이렉트 hop마다 매번 호출한다."""
    parsed = urlparse(url)

    if parsed.scheme not in ALLOWED_SCHEMES:
        raise BlockedUrlError(f"허용되지 않는 스킴입니다: {parsed.scheme or '(없음)'}")

    host = parsed.hostname
    if not host:
        raise BlockedUrlError("호스트가 없는 URL입니다.")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    for ip in _resolve_ips(host, port):
        if _is_blocked_ip(ip):
            raise BlockedUrlError(f"내부망 주소로 향하는 URL입니다: {host} -> {ip}")


def build_client() -> httpx.AsyncClient:
    """리다이렉트를 직접 처리해야 hop마다 검사할 수 있으므로 자동 추적을 끈다."""
    return httpx.AsyncClient(
        follow_redirects=False,
        timeout=TIMEOUT_SECONDS,
        headers={"User-Agent": USER_AGENT},
    )


async def fetch_html(url: str) -> tuple[str, str]:
    """(최종 URL, HTML)을 돌려준다. 매 hop마다 SSRF 검사를 다시 한다."""
    current_url = url

    async with build_client() as client:
        for _ in range(MAX_REDIRECTS + 1):
            assert_url_allowed(current_url)

            async with client.stream("GET", current_url) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise FetchError("Location 헤더가 없는 리다이렉트입니다.")
                    # 상대 경로 Location도 절대 URL로 만든 뒤 다시 검사한다.
                    current_url = urljoin(current_url, location)
                    continue

                if response.status_code >= 400:
                    raise FetchError(f"가져오기 실패: HTTP {response.status_code}")

                content_type = response.headers.get("content-type", "")
                if content_type.split(";")[0].strip().lower() != "text/html":
                    raise FetchError(f"HTML이 아닙니다: {content_type or '(없음)'}")

                declared_length = response.headers.get("content-length")
                if declared_length and int(declared_length) > MAX_RESPONSE_BYTES:
                    raise FetchError("응답이 너무 큽니다.")

                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_RESPONSE_BYTES:
                        raise FetchError("응답이 너무 큽니다.")

                return str(response.url), body.decode("utf-8", errors="replace")

    raise FetchError("리다이렉트가 너무 많습니다.")


def _meta_content(soup: BeautifulSoup, **attrs: str) -> str | None:
    tag = soup.find("meta", attrs=attrs)
    if tag is None:
        return None
    content = tag.get("content")
    if not isinstance(content, str):
        return None
    content = content.strip()
    return content or None


def extract_og(html: str, base_url: str) -> ParseResponse:
    soup = BeautifulSoup(html, "html.parser")

    title = _meta_content(soup, property="og:title")
    if title is None and soup.title and soup.title.string:
        title = soup.title.string.strip() or None

    description = _meta_content(soup, property="og:description")
    if description is None:
        description = _meta_content(soup, name="description")

    image_url = _meta_content(soup, property="og:image")
    if image_url:
        # og:image는 상대 경로일 수 있다.
        image_url = urljoin(base_url, image_url)

    return ParseResponse(title=title, description=description, image_url=image_url)


def _require_api_key(provided: str | None) -> None:
    expected = os.environ.get("OG_PARSER_API_KEY")
    if not expected:
        # 시크릿이 없으면 열어두지 않고 막는다.
        raise HTTPException(status_code=500, detail="OG_PARSER_API_KEY가 설정되지 않았습니다.")
    if provided != expected:
        raise HTTPException(status_code=401, detail="인증에 실패했습니다.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse", response_model=ParseResponse)
async def parse(
    request: ParseRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> ParseResponse:
    _require_api_key(x_api_key)

    try:
        assert_url_allowed(request.url)
    except BlockedUrlError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        final_url, html = await fetch_html(request.url)
    except BlockedUrlError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FetchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=422, detail=f"가져오기 실패: {exc}") from exc

    return extract_og(html, final_url)
