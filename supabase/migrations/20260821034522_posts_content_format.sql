-- content_format: 본문을 어떤 포맷의 "원문"으로 저장했는지 선언한다 (DATABASE.md §1.1).
-- 작성 시 이스케이프·변환을 하지 않고 렌더링만 이 값으로 분기하므로, 편집 왕복에서
-- 본문이 손실되지 않는다.
--
-- 기존 행은 모두 Markdown 에디터로 작성됐으므로 default 로 백필된다 — 렌더 결과가 바뀌지 않는다.
-- 값 누락 시의 폴백도 'MARKDOWN' 이어야 현행 동작과 같다.
alter table public.posts
  add column content_format text not null default 'MARKDOWN'
    check (content_format in ('MARKDOWN', 'PLAIN'));

-- RLS 정책·GRANT 는 손대지 않는다 — 둘 다 컬럼 단위가 아니라 테이블 단위로 걸려 있어
-- 컬럼 추가만으로 기존 권한이 그대로 적용된다.
