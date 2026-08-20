-- post-images 버킷: public read, 로그인 사용자만 업로드.
-- 용량/MIME 제한을 버킷에 걸어 서버에서 강제한다 (클라이언트 검증은 UX용일 뿐이다).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- 공개 버킷이므로 읽기는 누구나 가능하다.
create policy "post_images_read_all" on storage.objects
  for select using (bucket_id = 'post-images');

-- 업로드 경로는 `<uid>/<파일명>`으로 강제해 타인의 파일을 덮어쓰지 못하게 한다.
create policy "post_images_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- post_images: Storage에 올린 이미지의 메타데이터 (DATABASE.md §1.6)
create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index post_images_post_id_display_order_idx
  on public.post_images (post_id, display_order);

alter table public.post_images enable row level security;

create policy "post_images_select_all" on public.post_images
  for select using (true);

-- 행 기록은 해당 글의 작성자만 할 수 있다.
create policy "post_images_insert_post_author" on public.post_images
  for insert with check (
    exists (
      select 1 from public.posts
      where posts.id = post_images.post_id
        and posts.author_id = auth.uid()
    )
  );

create policy "post_images_delete_post_author" on public.post_images
  for delete using (
    exists (
      select 1 from public.posts
      where posts.id = post_images.post_id
        and posts.author_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.post_images to service_role;
grant select on public.post_images to anon, authenticated;
grant insert, delete on public.post_images to authenticated;
