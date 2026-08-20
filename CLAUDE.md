# Claude Code Development Rules

## 1. Core Principles
* **문서 우선:** 코드를 작성하기 전에 `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`를 반드시 확인한다.
* **작은 단위 구현:** 한 번에 전체를 구현하지 않고 PRD 기준의 독립적인 Task로 분리한다. (예: "게시판 전체 구현" ❌ -> "posts RLS 생성 -> 목록 UI 구현" ✅)
* **최소 변경:** 기존 기능을 깨뜨리지 않는 범위에서 가장 작은 변경을 한다.

## 2. Strict Constraints
* **Do not** modify database schema without migration.
* **Do not** bypass Row Level Security (RLS).
* **Do not** expose service_role_key to client.
* **Do not** add dependencies without justification.
* **Do not** implement Phase 2/3 features during MVP (Phase 1).

## 3. Workflow
1. **Understand:** 관련 문서를 읽고 현재 구조 분석
2. **Plan:** 필요한 DB/API/UI 변경사항 및 구현 계획 작성
3. **Implement:** 작은 단위로 코드 작성
4. **Test:** TypeScript, Lint, Build 통과 확인
5. **Review & Commit:** 정상 동작 시 커밋

## 4. Development Phases
* **Phase 0:** Project Foundation (Next.js, Tailwind, Supabase 초기화)
* **Phase 1:** Auth (소셜 로그인, 프로필 닉네임 설정)
* **Phase 2:** Post (목록, 상세, 작성, 수정, 삭제)
* **Phase 3:** Poll (투표 스키마, 중복 방지, 결과 UI)
* **Phase 4:** Comment (댓글 조회/작성/대댓글)
* **Phase 5:** Editor + OG (Draft 저장, 이미지, URL 감지 및 Python API 호출)
* **Phase 6:** MVP Launch (모바일 UX 최적화, 테스트, 배포)

## 5. Task Formatting
모든 기능 구현 요청은 다음 포맷을 따른다.
* Goal / Scope / Files / Database Changes / API Changes / UI Changes / Acceptance Criteria