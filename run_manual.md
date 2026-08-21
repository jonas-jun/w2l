# 로컬에서 페이지 띄워 확인하기

화면을 눈으로 확인해야 하는 변경(색상·레이아웃·모바일 UX)을 검증하는 절차다.
빌드·타입 체크가 통과했다고 화면이 의도대로 보이는 것은 아니므로, UI 변경은 반드시
이 문서의 절차로 한 번 눈으로 본다.

## 1. 사전 준비

```bash
node -v            # v24 이상 (검증: v24.19.0 / npm 11.17.0)
npm install        # node_modules 가 불완전할 때가 있다 — §7 참고
ls .env.local      # 없으면 cp .env.example .env.local 후 값 채우기
```

`.env.local` 에 최소한 아래 둘이 있어야 페이지가 뜬다. 없으면 Supabase 클라이언트
생성 단계에서 500 이 난다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY` · `OG_PARSER_URL` · `OG_PARSER_API_KEY` 은 서버 전용이고,
각각 계정 시딩 / OG 카드 기능에만 쓰인다. 색상·레이아웃만 볼 때는 없어도 된다.

## 2. 개발 서버 실행

```bash
npm run dev
```

정상 출력:

```
▲ Next.js 16.3.1 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://<사설IP>:3000
- Environments: .env.local
✓ Ready in 235ms
```

`- Environments: .env.local` 줄이 보이는지 확인한다. 이 줄이 없으면 환경 변수가
로드되지 않은 것이다.

포트를 바꾸려면 `npm run dev -- -p 3001`.

### 원격 개발 환경(VSCode Dev Container / Remote)에서 보기

이 레포는 원격 리눅스 컨테이너(`/workspace/...`, `REMOTE_CONTAINERS=true`)에서
작업하므로 **브라우저는 로컬 PC 에, 서버는 원격에** 있다. 둘을 잇는 포트 포워딩이
없으면 브라우저에서 `ERR_CONNECTION_REFUSED` 가 난다.

**반드시 VSCode 통합 터미널에서 포그라운드로 실행한다.**

```bash
npm run dev
```

이렇게 하면 VSCode 가 터미널 출력의 `http://localhost:3000` 을 감지해 자동으로
포워딩하고, "브라우저에서 열기" 알림까지 띄운다.

> **함정** — `nohup npm run dev &` 처럼 백그라운드/detached 로 띄우면 자동 포워딩이
> 걸리지 않는다. VSCode 의 자동 포워딩 기본 동작(`remote.autoForwardPortsSource`
> 가 `output`)은 **터미널 출력을 스캔**하는 방식이라, 출력이 파일로 빠지는
> 백그라운드 프로세스는 감지 대상에서 빠진다. 서버는 정상 실행 중이고 원격
> 내부에서는 `curl` 이 200 을 돌려주는데 브라우저만 연결 거부되는 증상이 나온다.
> Claude Code 등 에이전트가 대신 띄워준 서버도 같은 이유로 안 잡힌다.

**이미 백그라운드로 떠 있는 서버를 브라우저로 보려면** — 재시작 없이 수동
포워딩하면 된다.

1. VSCode 하단 패널의 **PORTS** 탭 (없으면 `Cmd/Ctrl + Shift + P` →
   `View: Toggle Ports`)
2. **Forward a Port** / **Add Port** → `3000` 입력
3. 목록에 뜬 Local Address(`localhost:3000`)의 지구본 아이콘으로 열기

**진단 순서** — 어디가 끊겼는지 구분한다.

```bash
# ① 원격 안에서 서버가 사는지
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/    # 기대: 200

# ② 어느 인터페이스에 붙었는지
ss -ltnp | grep :3000                                              # 기대: *:3000
```

①이 200 이고 브라우저만 거부되면 **100% 포워딩 문제**다. 서버·코드·방화벽이 아니다.

`Network:` 에 찍힌 사설 IP(`172.x.x.x`)로는 같은 망이 아니면 접근되지 않는다.
포워딩된 `localhost` 를 쓴다.

Remote-SSH 환경이라면 로컬 PC 터미널에서 터널을 직접 뚫어도 된다.

```bash
ssh -L 3000:localhost:3000 <원격호스트>
```

## 3. 봐야 할 화면

| 경로 | 로그인 필요 | 여기서 확인하는 것 |
|---|---|---|
| `/` | 아니오 | 전역 배경, 섹션 제목(보조 텍스트), 글 목록 카드, 하단 탭 |
| `/popular` | 아니오 | 빈 상태 문구, 하단 탭 활성 상태 |
| `/posts/<id>` | 아니오 | 본문 마크다운 — 코드 블록·인용·링크·OG 카드, 추천 버튼 |
| `/login`, `/signup` | 아니오 | 입력창 테두리, 에러 문구 색 |
| `/write` | 예 | 임시본 배너, 작성/미리보기 탭, 마크다운 미리보기 |
| `/profile` | 예 | 임시저장 목록, 빈 상태 문구 |

`/posts/<id>` 의 `<id>` 는 홈에서 글을 클릭해 얻는다. 로컬 DB 에 글이 없으면
`/write` 에서 하나 쓰고(코드 블록·인용·URL 을 섞어서) 그 글로 확인한다.

로그인이 필요한 경로는 비로그인 상태에서 `307` 로 `/login` 으로 넘어간다. 즉
`curl` 로 `/write` 가 307 이면 서버는 정상이고 인증만 없는 상태다.

빈 상태와 로딩 상태도 확인 대상이다. 로딩 스켈레톤은 네트워크를 느리게 만들면
보인다 — DevTools → Network → Throttling → Slow 4G.

## 4. light / dark 양쪽 확인

OS 설정을 건드리지 않고 브라우저에서 강제 전환한다.

**Chrome / Edge**
1. DevTools 열기 (F12)
2. `Cmd/Ctrl + Shift + P` → `Show Rendering` 입력 → Rendering 패널 열기
3. **Emulate CSS media feature prefers-color-scheme** → `light` / `dark` 선택

**Firefox**
- DevTools → Inspector 상단의 해/달 아이콘 토글

이 앱은 사용자 테마 토글이 없고 OS 설정(`prefers-color-scheme`)만 따르므로, 이
방법이 dark 를 보는 유일한 수단이다.

## 5. 색을 눈이 아니라 값으로 확인

눈으로는 "비슷해 보인다" 로 넘어가기 쉬우므로, 의심되면 값을 직접 읽는다.

**DevTools**
- 요소 선택 → Styles 패널에서 `var(--muted)` 같은 변수 위에 마우스를 올리면 실제 값이 뜬다
- Computed 탭에서 `color` / `background-color` 의 최종 계산값 확인

**터미널에서 한 번에 확인** (서버가 떠 있는 상태에서)

```bash
# theme-color meta — 모바일 주소창 색
curl -s http://localhost:3000/login | grep -o 'name="theme-color"[^>]*'

# CSS 토큰 값 (light 블록 → dark 블록 순서로 출력된다)
CSS=$(curl -s http://localhost:3000/login | grep -o '/_next/static/[^"]*\.css' | head -1)
curl -s "http://localhost:3000$CSS" \
  | grep -o -- '--background:[^;]*\|--foreground:[^;]*\|--muted:[^;]*\|--strong:[^;]*\|--surface:[^;]*'
```

현재 기대값 (issue #4, Solarized 기반):

```
light                     dark
--background: #fdf6e3     #002b36
--foreground: #586e75     #839496
--strong:     #073642     #93a1a1
--muted:      #5f747c     #7a9199
--surface:    #eee8d5     #073642
```

**어떤 유틸리티 클래스가 생성됐는지 확인** — Tailwind 는 실제로 쓰인 클래스만
CSS 로 내보내므로, 오타가 있으면 조용히 아무 스타일도 안 붙는다.

```bash
curl -s "http://localhost:3000$CSS" \
  | grep -o '\.text-muted\|\.text-strong\|\.border-warn\|\.text-danger' | sort -u
```

위 4개는 현재 실제로 쓰이고 있어 전부 나와야 한다. 반대로 `.bg-surface` 는 아무
컴포넌트도 쓰지 않으므로(마크다운 코드 블록이 `globals.css` 에서 `var(--surface)`
를 직접 쓴다) 검색해도 안 나오는 것이 정상이다.

즉 **써놓은 클래스가 CSS 에 없으면** `globals.css` 의 `@theme inline` 에 해당
`--color-*` 등록이 누락됐거나 클래스명 오타다.

## 6. 대비비(WCAG) 확인

색을 바꿨다면 대비를 같이 확인한다. 기준은 본문 4.5:1(AA).

**DevTools** — 요소 선택 → Styles 패널의 색상 스와치 클릭 → 컬러 피커에 `Contrast
ratio` 가 표시된다. AA/AAA 통과 여부까지 나온다.

**계산으로 확인**

```bash
python3 -c '
def lum(h):
    h=h.lstrip("#"); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in c]
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b):
    l=sorted([lum(a),lum(b)],reverse=True); return (l[0]+0.05)/(l[1]+0.05)
BG="#fdf6e3"
for fg in ["#586e75","#073642","#5f747c","#2076b3","#cb2522","#886700"]:
    r=cr(fg,BG); print(fg, round(r,2), "OK" if r>=4.5 else "LOW")'
```

주의 — `--surface`(`#eee8d5`) **위**에서는 `--foreground` 가 4.39:1 로 미달이다.
카드·코드 블록 안의 텍스트는 `--strong` 을 써야 한다. 배너 배경 위도 같다.

## 7. 프로덕션 빌드로 확인

dev 서버(Turbopack)와 프로덕션 빌드는 CSS 번들링 방식이 달라, dev 에서만 보이거나
dev 에서만 안 보이는 문제가 있을 수 있다. 배포 전에는 프로덕션 빌드로도 본다.

```bash
npm run build
npm start          # http://localhost:3000
```

`npm run build` 는 타입 체크까지 수행한다. 빌드 성공 시 라우트 목록과
`○ (Static) / ƒ (Dynamic)` 구분이 출력된다.

> **`npx tsc --noEmit` 은 `npm run build` 이후에 돌린다.** 라우트 리터럴 타입
> (`PageProps<"/posts/[id]">` 등)이 `.next/types` 에 생성되므로, 빌드 전에 돌리면
> 실제 오류가 아닌 route 타입 오류가 10건 이상 나온다.

## 8. 배포본 확인

`main` 에 merge 하면 Vercel 이 프로덕션 배포를 자동으로 돌린다.

```bash
curl -s https://w2l-delta.vercel.app/ | grep -o 'name="theme-color"[^>]*'

CSS=$(curl -s https://w2l-delta.vercel.app/ | grep -o '/_next/static/[^"]*\.css' | head -1)
curl -s "https://w2l-delta.vercel.app$CSS" | grep -o -- '--background:[^;]*'
```

값이 예전 것이면 아직 배포가 안 끝난 것이다. **CSS 파일명이 이전과 같은지** 보면
구분된다 — 파일명이 그대로면 새 빌드가 아직 안 올라갔다는 뜻이다. 빌드 진행 상황은
Vercel 대시보드의 Deployments 에서 본다.

Vercel Git 연동은 **소급 적용되지 않는다.** 연동을 붙인 시점보다 앞선 커밋에는
배포가 만들어지지 않으므로, 연동 직후에는 새 push 나 merge 가 있어야 첫 배포가 돈다.

## 9. 트러블슈팅

**`Cannot find module 'react-markdown'` / `'remark-gfm'`**
`package.json` 에는 선언되어 있는데 `node_modules` 가 불완전한 경우다. `npm install`
로 해결된다.

**포트 3000 이 이미 사용 중**
```bash
ss -ltnp | grep :3000        # 무엇이 쓰는지 확인
pkill -f "next dev"          # 기존 dev 서버 정리
npm run dev -- -p 3001       # 또는 다른 포트로 띄우기
```

**브라우저에서 `ERR_CONNECTION_REFUSED`**
원격 컨테이너 환경의 포트 포워딩 문제다. §2 의 진단 순서와 수동 포워딩을 따른다.
백그라운드로 띄운 서버는 자동 포워딩이 걸리지 않는다.

**색이 바뀌지 않는다**
1. 하드 리로드 (`Cmd/Ctrl + Shift + R`) — CSS 가 캐시됐을 수 있다
2. `globals.css` 의 `@theme inline` 에 해당 `--color-*` 를 등록했는지 확인.
   등록하지 않으면 `text-muted` 같은 유틸리티가 생성되지 않는다
3. §5 의 `grep` 으로 CSS 에 클래스가 실제로 들어갔는지 확인

**dark 모드가 안 보인다**
사용자 테마 토글이 없다. §4 의 DevTools 강제 전환을 쓴다.

**페이지가 500**
`.env.local` 의 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 를
확인한다. 터미널의 `npm run dev` 로그에 원인이 찍힌다.

## 10. 서버 종료

포그라운드면 `Ctrl + C`. 백그라운드로 띄웠다면:

```bash
pkill -f "next dev"
```
