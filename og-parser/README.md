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

> 아래 명령은 **사용자가 직접 실행**한다. 저장소 루트에서 실행할 것.

| 항목 | 값 | 비고 |
|---|---|---|
| 프로젝트 ID | `w2l-app` | GCP 프로젝트 ID는 **6~30자**라 `w2l`은 쓸 수 없다 |
| 리전 | `asia-northeast3` (서울) | 사용자·파싱 대상 사이트가 대부분 국내다 |
| 서비스 이름 | `og-parser` | |

```bash
# 0) 프로젝트 생성 (최초 1회) — 결제 계정 연결이 필요하다
gcloud projects create w2l-app --name=w2l-app
gcloud config set project w2l-app
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

# 1) 시크릿 생성 (최초 1회) — 출력된 값을 Next.js의 OG_PARSER_API_KEY에도 넣는다
openssl rand -hex 32 | tee /dev/tty | gcloud secrets create og-parser-api-key --data-file=-

# 2) Cloud Run 런타임 서비스 계정에 시크릿 읽기 권한 부여 (최초 1회)
PROJECT_NUMBER=$(gcloud projects describe w2l-app --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding og-parser-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3) 빌드 + 배포
gcloud run deploy og-parser \
  --source og-parser \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-secrets OG_PARSER_API_KEY=og-parser-api-key:latest
```

### 왜 `--allow-unauthenticated`인가

Cloud Run IAM으로 잠그면 호출하는 쪽(Vercel의 Next.js 서버)이 GCP 서비스 계정 키로 ID
토큰을 발급해야 한다. Vercel에 서비스 계정 키를 두고 인증 라이브러리를 추가하는 비용이
커서, **인그레스는 열되 앱 레벨에서 `X-API-Key`(256비트 공유 시크릿)로 인증**한다
(ARCHITECTURE.md §4의 설계 그대로). 파서 자체에 SSRF 방어·5초 타임아웃·1MB 제한이 있어
공개 노출로 늘어나는 위험은 키 유출·무차별 대입으로 한정된다. 키가 새면
`gcloud secrets versions add`로 새 버전을 올리고 재배포하면 된다.

Vercel 쪽 함수 리전도 서울(`icn1`)로 맞추면 Next.js → Cloud Run 호출이 국내에 머문다.
다만 OG 파싱은 **글 작성 시점에만** 일어나고 결과는 `link_previews`에 캐시되므로
(ARCHITECTURE.md §4), 이 구간 지연은 글 조회 성능에는 영향을 주지 않는다.

배포 후 나온 URL과 시크릿 값을 Next.js 쪽 환경 변수에 넣는다 —
`OG_PARSER_URL`, `OG_PARSER_API_KEY` (둘 다 **서버 전용**, `NEXT_PUBLIC_` 접두사 금지).
