# OG Parser

URL의 Open Graph 메타데이터를 파싱해 돌려주는 Python 서비스. Next.js 앱이 직접
외부 URL을 가져오지 않고 이 서비스를 거치게 해서 SSRF 위험을 한 곳에 가둔다
(`ARCHITECTURE.md` §2 · §4).

## API

### `POST /parse`

```
Header: X-API-Key: <공유 시크릿>
Body:   { "url": "https://example.com/article" }
```

```json
{
  "title": "제목",
  "description": "설명",
  "image_url": "https://example.com/cover.png"
}
```

값이 없는 필드는 `null`이다. `og:image`가 상대 경로면 절대 URL로 변환해 돌려준다.

| 상태 | 의미 |
|---|---|
| 400 | 차단된 URL (허용되지 않는 스킴, 내부망 주소) |
| 401 | `X-API-Key` 불일치 |
| 422 | 가져오기 실패 (HTML 아님, 크기 초과, 리다이렉트 초과, 상태 코드 오류) |
| 500 | `OG_PARSER_API_KEY` 미설정 |

### `GET /health`

인증 없이 접근 가능한 헬스체크.

## SSRF 방어

이 서비스는 임의의 URL을 대신 요청하므로, 내부망을 훑는 통로가 되지 않게 막는다.

- `http`/`https` 스킴만 허용 (`file://`, `gopher://` 등 거부)
- 호스트를 DNS 해석해 **해석된 모든 IP**를 검사 — private / loopback / link-local /
  reserved / multicast면 거부 (`169.254.169.254` 같은 클라우드 메타데이터 주소 포함)
- 리다이렉트 자동 추적을 끄고 직접 따라가며, **매 hop마다 주소를 다시 검사** (최대 3회)
- 타임아웃 5초, 응답 1MB 제한 (`Content-Length`가 없어도 읽는 도중에 끊는다)
- `text/html`만 파싱

## 환경 변수

| 이름 | 설명 |
|---|---|
| `OG_PARSER_API_KEY` | 공유 시크릿. **미설정 시 모든 요청을 500으로 막는다** (fail closed). |
| `PORT` | 리스닝 포트. Cloud Run이 자동으로 주입한다 (기본 8080). |

## 로컬 실행

```bash
cd og-parser
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt

# 테스트 (네트워크 없이 동작)
.venv/bin/python -m pytest

# 서버
OG_PARSER_API_KEY=dev-secret .venv/bin/uvicorn main:app --reload --port 8080
```

```bash
curl -X POST http://localhost:8080/parse \
  -H "X-API-Key: dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Cloud Run 배포

> 아래 명령은 **사용자가 직접 실행**한다. `PROJECT_ID`와 `REGION`을 채워 넣을 것.

```bash
gcloud config set project PROJECT_ID

# 1) 시크릿 생성 (최초 1회)
openssl rand -hex 32 | gcloud secrets create og-parser-api-key --data-file=-

# 2) 빌드 + 배포
gcloud run deploy og-parser \
  --source og-parser \
  --region REGION \
  --no-allow-unauthenticated \
  --set-secrets OG_PARSER_API_KEY=og-parser-api-key:latest
```

`--no-allow-unauthenticated`로 공개 노출을 막고, Next.js 서버에서 호출할 서비스 계정에만
`roles/run.invoker`를 부여한다.

배포 후 나온 URL과 시크릿 값을 Next.js 쪽 환경 변수에 넣는다 —
`OG_PARSER_URL`, `OG_PARSER_API_KEY` (둘 다 **서버 전용**, `NEXT_PUBLIC_` 접두사 금지).
