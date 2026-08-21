import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/PostCard";
import { hoursAgoIso } from "@/lib/format";
import { POST_LIST_SELECT, type PostListRow } from "@/lib/posts";

export const metadata: Metadata = {
  title: "인기",
  description: "최근 72시간 동안 가장 많은 추천을 받은 글.",
};

export default async function PopularPage() {
  const supabase = await createClient();
  const seventyTwoHoursAgo = hoursAgoIso(72);

  const { data: posts } = await supabase
    .from("posts")
    .select(POST_LIST_SELECT)
    .eq("status", "PUBLISHED")
    .is("comments.deleted_at", null)
    .gte("created_at", seventyTwoHoursAgo)
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<PostListRow[]>();

  return (
    <main className="flex flex-1 flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold">인기</h1>
      {posts && posts.length > 0 ? (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          최근 72시간 내 인기 글이 없습니다.
        </p>
      )}
    </main>
  );
}
