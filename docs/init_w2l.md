# w2l 작업 환경 세팅 계획서

> **Claude에게**: w2l 프로젝트(Next.js + Supabase 웹 서비스)용 개발 환경을 세팅하는 작업이다.
> 아래 단계를 **순서대로** 실행하고, 각 단계의 "검증"을 통과한 뒤 다음 단계로 넘어가라.
> 검증 실패 시 임의로 우회하지 말고 실패 내용을 보고하라. 이미 완료된 단계(파일/설정이 이미
> 존재)는 건너뛰되 검증만 수행하라. 마지막에 §6 체크리스트 결과를 표로 보고하라.

## 진행 상황 (2026-08-20)

- [x] §1 Claude Code CLI — 2.1.235 설치 확인
- [x] §2 Plugin — pr-review-toolkit@claude-plugins-official enabled 확인, 변경 없음
- [ ] §3 permission (`.claude/settings.local.json`) — **⛔ 사용자 직접 생성 필요** (아래 §3 참조)
- [x] §3 VS Code 워크스페이스 설정 (`.vscode/settings.json`) 생성
- [x] §4-1 `.gitignore` 생성 (working/ 포함, PAT 파일 보호 확인)
- [x] §4-2 `git init -b main` + 레포 로컬 identity (jonas-jun / junhot08@gmail.com)
- [x] §4-3 remote origin = https://github.com/jonas-jun/w2l (oss 없음)
- [ ] §4-4 github.com 인증 — 첫 push 시점에 확인 (credential helper 또는 SSH)
- [x] §5 격리 재확인 — 전역 파일 5종 mtime 미변경, 전역 git config 미변경(insteadof 2개 그대로), 전역 user.email 미설정 그대로

## 격리 원칙 (이 계획서의 전제)

이 pod는 pai/ml 작업 환경과 **공유**된다. 따라서:

1. **pai/ml 세션에 영향을 줄 수 있는 스코프는 건드리지 않는다.**
   - 수정 금지: `~/.claude/settings.json`, `~/.claude/CLAUDE.md`, `~/.pai_env.sh`,
     `~/.bashrc`/`~/.zshrc`, 전역 git config, VS Code **user** settings, user 스코프 plugin 목록
   - 수정 허용: `w2l/.claude/settings.local.json`, `w2l/.vscode/settings.json`,
     `w2l/.gitignore`, w2l 레포 로컬 git config — 전부 이 디렉토리 안에서만 효력이 있는 것들
2. **w2l 은 별도 GitHub(github.com)에서 작업하며, OSS(oss.navercorp.com)와 연결하지 않는다.**
   - oss remote 를 추가하지 않는다. pai plugin(manage-oss, create-pull-request 등)을 이
     프로젝트에서 호출하지 않는다.
   - ⚠️ 이 pod 에는 `GITHUB_TOKEN` 환경변수에 **OSS PAT** 가 전역으로 실려 있다 (`~/.pai_env.sh`).
     `gh` CLI 와 다수 스크립트는 `GITHUB_TOKEN`/`GH_TOKEN` 을 자동으로 인증에 쓰므로, w2l 에서
     github.com 을 향해 이 변수가 실리면 **OSS PAT 가 외부로 전송**된다. §4 의 인증 규칙을 따를 것.
   - 전역 git insteadOf 재작성 규칙은 `oss.navercorp.com` URL 에만 매칭되므로 github.com
     작업에는 영향 없음 (2026-08-20 확인).

> 원본은 `working/init.md`(pai pod 세팅 작업지시서)다. 그 문서의 §1(PAT)·§3(pai plugin)·
> §5(autoMode 사내망 environment)·§6(pai/ml 개인 CLAUDE.md)은 pai 전용이므로 이 프로젝트에
> 적용하지 않는다.

## 1. Claude Code CLI 설치

이미 설치되어 있으면(`claude --version` 성공) 검증만 하고 건너뛴다. (이 pod 에는 이미 설치돼
있을 가능성이 높다 — pai 세팅과 공유하는 유일한 전역 요소이며, 같은 바이너리를 쓰는 것은
pai/ml 에 영향을 주지 않는다.)

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

- 검증: `claude --version`이 버전을 출력하고, `which claude`가 경로를 반환한다.

## 2. Plugin 확인 (설치 아님)

`pr-review-toolkit@claude-plugins-official` 은 이미 user 스코프로 설치돼 있다 (2026-08-20
확인 — marketplace `anthropics/claude-plugins-official` 도 등록됨). PR 전 자체 리뷰
(`/pr-review-toolkit:review-pr`)에 이것을 쓴다. **새로 설치·변경할 것은 없다** — user 스코프
plugin 목록을 바꾸면 pai/ml 세션에도 반영되므로, 이 프로젝트를 위해 plugin 을 추가로
설치하거나 제거하지 않는다.

- 검증: `claude plugin list` 에 `pr-review-toolkit@claude-plugins-official` (enabled) 존재.
- pai plugin 5종(pai-productivity 등)도 목록에 보이지만 **이 프로젝트에서는 호출하지 않는다**
  (전부 OSS/Jira/사내 인프라 연동이다). 제거하지도 않는다 — pai/ml 세션이 쓴다.

## 3. Permission + auto 모드 (프로젝트 로컬)

w2l 개발 루프가 프롬프트 없이 돌도록 하되, 설정은 **`w2l/.claude/settings.local.json`**
(프로젝트 로컬, git 미추적, 다른 디렉토리 세션에 무효)에만 넣는다.
`~/.claude/settings.json` 은 건드리지 않는다.

> ⛔ **이 파일은 Claude 가 만들 수 없다** (2026-08-20 실측: Write 가 auto 모드 분류기에
> 차단됨). 자기를 제약하는 권한 규칙을 스스로 넓히는 쓰기는 대화상 승인으로도 열리지 않는
> 설계 경계다 — 원본 init.md §5-3 의 `GHE REST Equivalence` 항목과 같은 이유. **사용자가
> 터미널에서 직접** 아래를 실행할 것:
>
> ```bash
> cd /workspace/storage/cephrbd/git/w2l && mkdir -p .claude
> cat > .claude/settings.local.json <<'EOF'
> {
>   "permissions": {
>     "defaultMode": "auto",
>     "allow": [
>       "Bash(git *)",
>       "Bash(npm *)",
>       "Bash(npx *)",
>       "Bash(node *)",
>       "Bash(supabase *)"
>     ]
>   }
> }
> EOF
> ```

파일이 없으면 아래 내용으로 생성하고, 있으면 병합한다 (기존 항목 삭제 금지):

```json
{
  "permissions": {
    "defaultMode": "auto",
    "allow": [
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(supabase *)"
    ]
  }
}
```

> autoMode 의 커스텀 environment 선언(원본 init.md §5-3)은 가져오지 않는다 — 내용 전체가
> 사내망 전제이고, 그걸 선언하는 위치(`~/.claude/settings.json`)가 user 스코프라 pai/ml 에
> 영향을 준다. w2l 은 기본 environment 그대로 auto 모드만 쓴다.
> 패키지 매니저를 pnpm/yarn 으로 바꾸면 해당 allow 규칙을 같은 파일에 추가한다.

- 검증: `python3 -c "import json; d=json.load(open('.claude/settings.local.json')); assert d['permissions']['defaultMode']=='auto'"` (w2l 루트에서) 통과, allow 5개 존재.
- 검증(격리): `~/.claude/settings.json` 의 mtime 이 이 단계 전후로 변하지 않았다.

### VS Code (워크스페이스 설정)

`~/.vscode-server/data/User/settings.json`(user 설정)이 아니라 **`w2l/.vscode/settings.json`**
(워크스페이스 설정)에 넣는다 — user 설정에 넣으면 pai/ml 워크스페이스에도 적용된다.

```json
{ "claudeCode.initialPermissionMode": "auto" }
```

> 확장 2.1.222+ 기준 이 설정의 enum에 `auto`가 빠져 있어 편집기에 노란 경고가 뜬다.
> 런타임은 문자열을 그대로 전달하므로 정상 동작한다 — 무시해도 된다.

## 4. Git 초기화 + GitHub 연결 (OSS 격리)

이 디렉토리는 아직 git 레포가 아니다. 초기화하고 github.com 에만 연결한다.

### 4-1. gitignore 먼저 (⚠️ 순서 중요)

`working/init.md` 에 **실제 PAT 토큰이 들어 있다.** 첫 커밋 전에 반드시 gitignore 를 만든다:

```bash
cd /workspace/storage/cephrbd/git/w2l
cat > .gitignore <<'EOF'
working/
node_modules/
.next/
.env*.local
.env
.claude/settings.local.json
EOF
```

### 4-2. git init + 레포 로컬 identity

전역 git config 는 건드리지 않고, identity 는 **레포 로컬**로만 설정한다:

```bash
git init -b main
git config user.name  "jonas-jun"
git config user.email "junhot08@gmail.com"
```

### 4-3. remote 는 github.com 만

```bash
git remote add origin https://github.com/jonas-jun/w2l   # oss.navercorp.com 금지
```

### 4-4. github.com 인증 — OSS PAT 유출 방지

- **금지**: `gh` CLI 및 `GITHUB_TOKEN`/`GH_TOKEN` 을 읽는 스크립트로 github.com 을 호출하는 것.
  이 변수들에는 OSS PAT 가 실려 있어 그대로 github.com 에 전송된다. 부득이 `gh` 를 쓰려면
  반드시 `env -u GITHUB_TOKEN -u GH_TOKEN gh ...` 로 변수를 벗기고 `gh auth login` 기반
  (`GH_HOST` 미설정) 인증을 쓴다.
- **권장**: git push/pull 은 VS Code Remote 의 credential helper(전역 credential.helper 로 이미
  설정됨 — 로컬 VS Code 의 GitHub 인증을 포워딩)를 그대로 쓰거나, github.com 전용 SSH 키를
  만들어 `git@github.com:` remote 를 쓴다. 둘 다 OSS 자격증명과 무관하다.

### 검증

```bash
git remote -v | grep -v oss.navercorp.com && ! git remote -v | grep -q oss.navercorp.com  # remote에 oss 없음
git check-ignore working/init.md                        # working/ 이 ignore 됨
git config user.email                                    # 레포 로컬 identity 존재
git config --global user.email; echo "(전역은 비어있거나 기존값 그대로여야 함)"
git ls-files | grep -c '^working/' | grep -qx 0 || echo "FAIL: working/ 이 추적됨"
```

## 5. 격리 재확인 (사후 검증)

모든 단계 후, pai/ml 에 영향을 주는 전역 파일이 변하지 않았는지 확인한다:

```bash
# 이 계획서 실행 중 아래 파일들이 수정되지 않았어야 한다 (mtime 또는 diff 로 확인)
ls -l ~/.claude/settings.json ~/.claude/CLAUDE.md ~/.pai_env.sh ~/.bashrc ~/.zshrc 2>/dev/null
git config --global --list | grep -c insteadof   # 2 (기존 oss 규칙 그대로, 추가·삭제 없음)
```

## 6. 최종 검증 체크리스트

| # | 항목 | 확인 방법 |
|---|------|-----------|
| 1 | claude CLI | `claude --version` 성공 |
| 2 | plugin | `claude plugin list`에 pr-review-toolkit (enabled), 신규 설치·제거 없음 |
| 3 | permission (프로젝트 로컬) | `w2l/.claude/settings.local.json`에 defaultMode auto + allow 5개 |
| 4 | VS Code (워크스페이스) | `w2l/.vscode/settings.json`의 `claudeCode.initialPermissionMode == "auto"` |
| 5 | gitignore | `git check-ignore working/init.md` 통과 (PAT 파일 보호) |
| 6 | git identity | 레포 로컬 `user.name`/`user.email` 설정, 전역 미변경 |
| 7 | remote 격리 | `git remote -v`에 github.com 만, oss.navercorp.com 없음 |
| 8 | 전역 격리 | `~/.claude/settings.json`·`~/.pai_env.sh`·전역 git config 미변경 |
