-- posts: 일반 게시글 (DATABASE.md §1.1). post_type은 MVP에서 NORMAL 고정 —
-- POLL은 Phase 2 마이그레이션에서 CHECK를 완화하며 추가한다.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null,
  content text not null default '',
  post_type text not null default 'NORMAL' check (post_type = 'NORMAL'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'DELETED')),
  view_count int not null default 0,
  like_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint posts_deleted_at_matches_status check ((status = 'DELETED') = (deleted_at is not null))
);

create index posts_status_created_at_idx on public.posts (status, created_at desc);
create index posts_status_like_count_created_at_idx on public.posts (status, like_count desc, created_at desc);

alter table public.posts enable row level security;

-- 공개글은 누구나, DRAFT/DELETED는 작성자만 SELECT 가능(소유 확인용).
-- 목록/피드에서 DELETED를 숨기는 것은 애플리케이션 쿼리 필터의 책임이다 (ARCHITECTURE.md §3).
create policy "posts_select_published_or_own" on public.posts
  for select using (status = 'PUBLISHED' or author_id = auth.uid());

create policy "posts_insert_own" on public.posts
  for insert with check (author_id = auth.uid());

create policy "posts_update_own" on public.posts
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "posts_delete_own" on public.posts
  for delete using (author_id = auth.uid());

-- 테이블 GRANT: RLS와 별개로 필요 (memory: supabase-grant-required 참고)
grant select, insert, update, delete on public.posts to service_role;
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;

create trigger posts_set_updated_at
  before update on public.posts
  for each row
  execute function public.set_updated_at();

-- increment_view_count: posts UPDATE가 작성자 전용이므로 비로그인 포함 누구나 호출 가능한
-- SECURITY DEFINER RPC로 view_count만 증가시킨다 (ARCHITECTURE.md §3.1).
create function public.increment_view_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set view_count = view_count + 1 where id = p_post_id;
end;
$$;

grant execute on function public.increment_view_count(uuid) to anon, authenticated;

-- post_likes: 추천 이벤트 테이블 (DATABASE.md §1.5)
create table public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_likes enable row level security;

create policy "post_likes_select_all" on public.post_likes
  for select using (true);

create policy "post_likes_insert_own" on public.post_likes
  for insert with check (user_id = auth.uid());

create policy "post_likes_delete_own" on public.post_likes
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.post_likes to service_role;
grant select on public.post_likes to anon, authenticated;
grant insert, delete on public.post_likes to authenticated;

-- like_count 캐시 갱신: post_likes 변경 시에만, 트리거로만 갱신한다 (ARCHITECTURE.md §3.1).
-- posts UPDATE가 작성자 전용 RLS라서 SECURITY DEFINER로 이를 우회한다.
create function public.adjust_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.posts set like_count = like_count - 1 where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger post_likes_adjust_count
  after insert or delete on public.post_likes
  for each row
  execute function public.adjust_post_like_count();
