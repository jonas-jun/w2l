-- Realtime은 supabase_realtime publication에 포함된 테이블의 변경만 전송한다.
-- ARCHITECTURE.md §4에 따라 Realtime 적용 범위는 댓글로 한정한다 —
-- 다른 테이블은 추가하지 않는다 (비용/성능 최적화).
alter publication supabase_realtime add table public.comments;
