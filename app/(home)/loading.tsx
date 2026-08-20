import PostListSkeleton from "@/components/PostListSkeleton";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">인기</h2>
        <PostListSkeleton rows={3} />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">최신</h2>
        <PostListSkeleton rows={5} />
      </section>
    </main>
  );
}
