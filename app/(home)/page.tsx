import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/PostCard";
import { hoursAgoIso } from "@/lib/format";
import { POST_LIST_SELECT, type PostListRow } from "@/lib/posts";

const PAGE_SIZE = 20;

function PostSection({
  heading,
  posts,
  emptyText,
  children,
}: {
  heading: string;
  posts: PostListRow[] | null;
  emptyText: string;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted">
        {heading}
      </h2>
      {posts && posts.length > 0 ? (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{emptyText}</p>
      )}
      {children}
    </section>
  );
}

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
      .returns<PostListRow[]>(),
    supabase
      .from("posts")
      .select(POST_LIST_SELECT)
      .eq("status", "PUBLISHED")
      .is("comments.deleted_at", null)
      .order("created_at", { ascending: false })
      .range(0, limit - 1)
      .returns<PostListRow[]>(),
  ]);

  const hasMore = (latestPosts?.length ?? 0) >= limit;

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <PostSection
        heading="인기"
        posts={popularPosts}
        emptyText="아직 인기 글이 없습니다."
      />
      <PostSection heading="최신" posts={latestPosts} emptyText="아직 글이 없습니다.">
        {hasMore && (
          <Link
            href={`/?limit=${limit + PAGE_SIZE}`}
            className="mt-4 block rounded border border-black/20 py-2 text-center text-sm dark:border-white/20"
          >
            더 보기
          </Link>
        )}
      </PostSection>
    </main>
  );
}
