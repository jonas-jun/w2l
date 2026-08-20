"""OG 파서 테스트.

외부 네트워크 없이 돌아야 하므로 httpx 내장 MockTransport로 응답을 흉내낸다.
SSRF 검사(_resolve_ips)는 실제 로직을 그대로 쓰되, 정상 경로 테스트에서만
공인 IP로 해석되는 것처럼 패치한다.
"""

import httpx
import pytest
from fastapi.testclient import TestClient

import main

API_KEY = "test-secret"

HTML = """
<html>
  <head>
    <title>폴백 제목</title>
    <meta property="og:title" content="OG 제목" />
    <meta property="og:description" content="OG 설명" />
    <meta property="og:image" content="/img/cover.png" />
  </head>
  <body>본문</body>
</html>
"""


@pytest.fixture(autouse=True)
def api_key(monkeypatch):
    monkeypatch.setenv("OG_PARSER_API_KEY", API_KEY)


@pytest.fixture
def client():
    return TestClient(main.app)


def mock_transport(handler):
    """build_client를 MockTransport를 쓰는 클라이언트로 바꿔치기한다."""

    def build():
        return httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            follow_redirects=False,
            timeout=main.TIMEOUT_SECONDS,
        )

    return build


def allow_public_dns(monkeypatch):
    """테스트용 도메인이 공인 IP로 해석되는 것처럼 만든다."""
    monkeypatch.setattr(main, "_resolve_ips", lambda host, port: ["93.184.216.34"])


def html_response(request):
    return httpx.Response(
        200, headers={"content-type": "text/html; charset=utf-8"}, text=HTML
    )


# --- 정상 파싱 ---------------------------------------------------------------


def test_parses_og_metadata(client, monkeypatch):
    allow_public_dns(monkeypatch)
    monkeypatch.setattr(main, "build_client", mock_transport(html_response))

    res = client.post(
        "/parse", json={"url": "https://example.com/article"}, headers={"X-API-Key": API_KEY}
    )

    assert res.status_code == 200
    assert res.json() == {
        "title": "OG 제목",
        "description": "OG 설명",
        # 상대 경로 og:image가 절대 URL로 변환되어야 한다.
        "image_url": "https://example.com/img/cover.png",
    }


def test_falls_back_to_title_tag(client, monkeypatch):
    allow_public_dns(monkeypatch)
    html = "<html><head><title>제목만</title></head><body>x</body></html>"
    monkeypatch.setattr(
        main,
        "build_client",
        mock_transport(
            lambda request: httpx.Response(
                200, headers={"content-type": "text/html"}, text=html
            )
        ),
    )

    res = client.post(
        "/parse", json={"url": "https://example.com/"}, headers={"X-API-Key": API_KEY}
    )

    assert res.status_code == 200
    assert res.json() == {"title": "제목만", "description": None, "image_url": None}


# --- SSRF 방어 ---------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",  # 클라우드 메타데이터
        "http://localhost:8080/admin",
        "http://127.0.0.1/",
        "http://10.0.0.5/",
        "http://192.168.0.1/",
        "http://172.16.0.1/",
        "http://[::1]/",
        "http://0.0.0.0/",
    ],
)
def test_blocks_internal_addresses(client, url):
    res = client.post("/parse", json={"url": url}, headers={"X-API-Key": API_KEY})
    assert res.status_code == 400


@pytest.mark.parametrize(
    "url",
    ["file:///etc/passwd", "gopher://example.com/", "ftp://example.com/", "//example.com"],
)
def test_blocks_non_http_schemes(client, url):
    res = client.post("/parse", json={"url": url}, headers={"X-API-Key": API_KEY})
    assert res.status_code == 400


def test_blocks_redirect_to_private_ip(client, monkeypatch):
    """최초 URL은 공인이지만 내부망으로 리다이렉트하는 경우 — 매 hop 재검사로 막아야 한다."""
    real_resolve = main._resolve_ips

    def resolve(host, port):
        if host == "example.com":
            return ["93.184.216.34"]
        return real_resolve(host, port)

    monkeypatch.setattr(main, "_resolve_ips", resolve)
    monkeypatch.setattr(
        main,
        "build_client",
        mock_transport(
            lambda request: httpx.Response(302, headers={"location": "http://192.168.1.1/"})
        ),
    )

    res = client.post(
        "/parse", json={"url": "https://example.com/redirect"}, headers={"X-API-Key": API_KEY}
    )

    assert res.status_code == 400
    assert "내부망" in res.json()["detail"]


def test_blocks_redirect_to_metadata_service(client, monkeypatch):
    real_resolve = main._resolve_ips

    def resolve(host, port):
        if host == "example.com":
            return ["93.184.216.34"]
        return real_resolve(host, port)

    monkeypatch.setattr(main, "_resolve_ips", resolve)
    monkeypatch.setattr(
        main,
        "build_client",
        mock_transport(
            lambda request: httpx.Response(
                302, headers={"location": "http://169.254.169.254/latest/meta-data/"}
            )
        ),
    )

    res = client.post(
        "/parse", json={"url": "https://example.com/r"}, headers={"X-API-Key": API_KEY}
    )
    assert res.status_code == 400


def test_stops_after_max_redirects(client, monkeypatch):
    allow_public_dns(monkeypatch)
    monkeypatch.setattr(
        main,
        "build_client",
        mock_transport(
            lambda request: httpx.Response(
                302, headers={"location": "https://example.com/next"}
            )
        ),
    )

    res = client.post(
        "/parse", json={"url": "https://example.com/loop"}, headers={"X-API-Key": API_KEY}
    )

    assert res.status_code == 422
    assert "리다이렉트" in res.json()["detail"]


# --- 응답 제한 ---------------------------------------------------------------


def test_rejects_non_html(client, monkeypatch):
    allow_public_dns(monkeypatch)
    monkeypatch.setattr(
        main,
        "build_client",
        mock_transport(
            lambda request: httpx.Response(
                200, headers={"content-type": "application/json"}, text="{}"
            )
        ),
    )

    res = client.post(
        "/parse", json={"url": "https://example.com/api"}, headers={"X-API-Key": API_KEY}
    )
    assert res.status_code == 422


def test_rejects_oversized_body(client, monkeypatch):
    allow_public_dns(monkeypatch)
    big = "a" * (main.MAX_RESPONSE_BYTES + 10)
    monkeypatch.setattr(
        main,
        "build_client",
        mock_transport(
            lambda request: httpx.Response(
                200, headers={"content-type": "text/html"}, text=big
            )
        ),
    )

    res = client.post(
        "/parse", json={"url": "https://example.com/big"}, headers={"X-API-Key": API_KEY}
    )
    assert res.status_code == 422
    assert "큽니다" in res.json()["detail"]


def test_rejects_oversized_stream_without_content_length(client, monkeypatch):
    """Content-Length를 숨기고 계속 흘려보내는 응답도 읽는 도중에 끊어야 한다."""
    allow_public_dns(monkeypatch)

    async def endless_chunks():
        # 제한을 넘을 때까지 무한정 보내는 서버를 흉내낸다.
        while True:
            yield b"a" * 64 * 1024

    monkeypatch.setattr(
        main,
        "build_client",
        mock_transport(
            lambda request: httpx.Response(
                200,
                headers={"content-type": "text/html"},
                content=endless_chunks(),
            )
        ),
    )

    res = client.post(
        "/parse", json={"url": "https://example.com/endless"}, headers={"X-API-Key": API_KEY}
    )
    assert res.status_code == 422
    assert "큽니다" in res.json()["detail"]


def test_rejects_error_status(client, monkeypatch):
    allow_public_dns(monkeypatch)
    monkeypatch.setattr(
        main,
        "build_client",
        mock_transport(lambda request: httpx.Response(404, text="nope")),
    )

    res = client.post(
        "/parse", json={"url": "https://example.com/missing"}, headers={"X-API-Key": API_KEY}
    )
    assert res.status_code == 422


# --- 인증 --------------------------------------------------------------------


def test_rejects_missing_api_key(client):
    res = client.post("/parse", json={"url": "https://example.com/"})
    assert res.status_code == 401


def test_rejects_wrong_api_key(client):
    res = client.post(
        "/parse", json={"url": "https://example.com/"}, headers={"X-API-Key": "wrong"}
    )
    assert res.status_code == 401


def test_fails_closed_without_configured_secret(client, monkeypatch):
    """시크릿 미설정 시 열어두지 않고 막는다."""
    monkeypatch.delenv("OG_PARSER_API_KEY", raising=False)
    res = client.post(
        "/parse", json={"url": "https://example.com/"}, headers={"X-API-Key": API_KEY}
    )
    assert res.status_code == 500


def test_health_needs_no_key(client):
    assert client.get("/health").status_code == 200
