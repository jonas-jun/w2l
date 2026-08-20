-- link_previews: OG 파싱 결과의 URL 단위 캐시 (DATABASE.md §1.7)
-- posts와 FK가 없는 독립 테이블이다 — 같은 URL이면 어느 글에서든 재사용한다.
create table public.link_previews (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  og_title text,
  og_description text,
  og_image_url text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.link_previews enable row level security;

create policy "link_previews_select_all" on public.link_previews
  for select using (true);

-- 쓰기 정책은 만들지 않는다 (ARCHITECTURE.md §3).
-- 갱신은 Route Handler(/api/og)가 service_role로만 수행한다 — service_role은 RLS를
-- 우회하지만 테이블 GRANT는 별도로 필요하다.
grant select, insert, update, delete on public.link_previews to service_role;
grant select on public.link_previews to anon, authenticated;
