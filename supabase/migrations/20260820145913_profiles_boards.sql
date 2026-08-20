-- profiles: Supabase Auth와 분리된 서비스 프로필 (DATABASE.md §1.4)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique,
  tier text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- postgres가 만든 테이블은 anon/authenticated/service_role에 SELECT/INSERT/UPDATE/DELETE가
-- 기본 부여되지 않는다 (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN만 기본 부여됨).
-- RLS는 이 GRANT 위에 추가되는 행 단위 제약이므로 GRANT 없이는 RLS 정책이 있어도 API가 거부된다.
-- service_role은 RLS는 bypass하지만 GRANT는 별개라 마찬가지로 명시해야 한다.
grant select, insert, update, delete on public.profiles to service_role;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- updated_at 자동 갱신 (posts, comments 등 이후 테이블에서도 재사용)
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- boards: 다중 게시판 구조 (DATABASE.md §1.0). 쓰기는 마이그레이션/service_role 전용.
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.boards enable row level security;

create policy "boards_select_all" on public.boards
  for select using (true);

grant select, insert, update, delete on public.boards to service_role;
grant select on public.boards to anon, authenticated;

insert into public.boards (slug, name) values ('free', '자유게시판');
