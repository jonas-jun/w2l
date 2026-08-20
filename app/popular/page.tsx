import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/PostCard";
import { hoursAgoIso } from "@/lib/format";

interface PostRow {
  id: string;
  title: string;
  created_at: string;
  like_count: number;
  view_count: number;
  profiles: { nickname: string } | null;
  comments: { count: number }[];
}

export default async function PopularPage() {
  const supabase = await createClient();
  const seventyTwoHoursAgo = hoursAgoIso(72);

  const { data: posts } = await supabase
    .from("posts")
    // 댓글수는 삭제되지 않은 댓글만 센다.
    .select("id, title, created_at, like_count, view_count, profiles(nickname), comments(count)")
    .eq("status", "PUBLISHED")
    .is("comments.deleted_at", null)
    .gte("created_at", seventyTwoHoursAgo)
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<PostRow[]>();

  return (
    <main className="flex flex-1 flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold">인기</h1>
      {posts && posts.length > 0 ? (
        <div>
          {posts.map((post) => (
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          최근 72시간 내 인기 글이 없습니다.
        </p>
      )}
    </main>
  );
}
