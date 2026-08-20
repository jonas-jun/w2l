import PostListSkeleton from "@/components/PostListSkeleton";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold">인기</h1>
      <PostListSkeleton />
    </main>
  );
}
