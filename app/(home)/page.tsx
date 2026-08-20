import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/PostCard";
import { hoursAgoIso } from "@/lib/format";

const PAGE_SIZE = 20;

interface PostRow {
  id: string;
  title: string;
  created_at: string;
  like_count: number;
  view_count: number;
  profiles: { nickname: string } | null;
  comments: { count: number }[];
}

// 댓글수는 삭제되지 않은 댓글만 센다 (embedded 필터 `comments.deleted_at is null`).
const POST_LIST_SELECT =
  "id, title, created_at, like_count, view_count, profiles(nickname), comments(count)";

export default async function Home(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const limit = Math.max(PAGE_SIZE, Number(searchParams.limit) || PAGE_SIZE);

  const supabase = await createClient();
  const seventyTwoHoursAgo = hoursAgoIso(72);

  const [{ data: popularPosts }, { data: latestPosts }] = await Promise.all([
    supabase
      .from("posts")
      .select(POST_LIST_SELECT)
      .eq("status", "PUBLISHED")
      .is("comments.deleted_at", null)
      .gte("created_at", seventyTwoHoursAgo)
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<PostRow[]>(),
    supabase
      .from("posts")
      .select(POST_LIST_SELECT)
      .eq("status", "PUBLISHED")
      .is("comments.deleted_at", null)
      .order("created_at", { ascending: false })
      .range(0, limit - 1)
      .returns<PostRow[]>(),
  ]);

  const hasMore = (latestPosts?.length ?? 0) >= limit;

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">인기</h2>
        {popularPosts && popularPosts.length > 0 ? (
          <div>
            {popularPosts.map((post) => (
              <PostCard
                key={post.id}
                id={post.id}
                title={post.title}
                nickname={post.profiles?.nickname ?? "알 수 없음"}
                createdAt={post.created_at}
                likeCount={post.like_count}
                viewCount={post.view_count}
                commentCount={post.comments[0]?.count ?? 0}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">아직 인기 글이 없습니다.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">최신</h2>
        {latestPosts && latestPosts.length > 0 ? (
          <div>
            {latestPosts.map((post) => (
              <PostCard
                key={post.id}
                id={post.id}
                title={post.title}
                nickname={post.profiles?.nickname ?? "알 수 없음"}
                createdAt={post.created_at}
                likeCount={post.like_count}
                viewCount={post.view_count}
                commentCount={post.comments[0]?.count ?? 0}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">아직 글이 없습니다.</p>
        )}
        {hasMore && (
          <Link
            href={`/?limit=${limit + PAGE_SIZE}`}
            className="mt-4 block rounded border border-black/20 py-2 text-center text-sm dark:border-white/20"
          >
            더 보기
          </Link>
        )}
      </section>
    </main>
  );
}
