-- comments: 1-depth 대댓글을 위한 self-reference 구조 (DATABASE.md §1.3)
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  content text not null,
  like_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comments_post_id_created_at_idx on public.comments (post_id, created_at);
create index comments_parent_id_idx on public.comments (parent_id);

alter table public.comments enable row level security;

-- 삭제된 댓글도 SELECT 가능하다 — 대댓글이 달린 경우 "삭제된 댓글입니다" 자리 유지가
-- 필요하기 때문이다 (PRD §4.1). 표시 여부는 UI가 판단한다.
create policy "comments_select_all" on public.comments
  for select using (true);

create policy "comments_insert_own" on public.comments
  for insert with check (author_id = auth.uid());

create policy "comments_update_own" on public.comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "comments_delete_own" on public.comments
  for delete using (author_id = auth.uid());

grant select, insert, update, delete on public.comments to service_role;
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;

create trigger comments_set_updated_at
  before update on public.comments
  for each row
  execute function public.set_updated_at();

-- 1-depth 강제: 대댓글의 부모는 반드시 원댓글(parent_id IS NULL)이어야 한다.
-- 부모가 다른 글의 댓글인 경우도 함께 차단한다.
create function public.enforce_comment_depth()
returns trigger
language plpgsql
as $$
declare
  v_parent_parent_id uuid;
  v_parent_post_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select parent_id, post_id into v_parent_parent_id, v_parent_post_id
  from public.comments
  where id = new.parent_id;

  if not found then
    raise exception '부모 댓글을 찾을 수 없다.';
  end if;

  if v_parent_parent_id is not null then
    raise exception '대댓글에는 다시 답글을 달 수 없다 (1-depth 제한).';
  end if;

  if v_parent_post_id <> new.post_id then
    raise exception '부모 댓글과 같은 게시글이어야 한다.';
  end if;

  return new;
end;
$$;

create trigger comments_enforce_depth
  before insert or update on public.comments
  for each row
  execute function public.enforce_comment_depth();

-- comment_likes: 댓글 추천 이벤트 테이블 (DATABASE.md §1.5)
create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

create policy "comment_likes_select_all" on public.comment_likes
  for select using (true);

create policy "comment_likes_insert_own" on public.comment_likes
  for insert with check (user_id = auth.uid());

create policy "comment_likes_delete_own" on public.comment_likes
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.comment_likes to service_role;
grant select on public.comment_likes to anon, authenticated;
grant insert, delete on public.comment_likes to authenticated;

-- like_count 캐시는 트리거로만 갱신한다 (ARCHITECTURE.md §3.1).
-- comments UPDATE가 작성자 전용 RLS라서 SECURITY DEFINER로 우회한다.
create function public.adjust_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.comments set like_count = like_count - 1 where id = old.comment_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger comment_likes_adjust_count
  after insert or delete on public.comment_likes
  for each row
  execute function public.adjust_comment_like_count();
