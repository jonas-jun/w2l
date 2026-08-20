import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PostForm from "@/components/PostForm";

export default async function WritePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: board } = await supabase
    .from("boards")
    .select("id")
    .eq("slug", "free")
    .single();

  if (!board) {
    throw new Error("free 게시판을 찾을 수 없습니다.");
  }

  return (
    <main className="flex flex-1 flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold">글쓰기</h1>
      <PostForm mode="create" boardId={board.id} />
    </main>
  );
}
