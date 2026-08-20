import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PostForm from "@/components/PostForm";

export default async function EditPostPage(props: PageProps<"/write/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: post } = await supabase
    .from("posts")
    .select("id, title, content, author_id")
    .eq("id", id)
    .maybeSingle();

  if (!post) {
    notFound();
  }

  if (post.author_id !== user.id) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold">글 수정</h1>
      <PostForm
        mode="edit"
        postId={post.id}
        initialTitle={post.title}
        initialContent={post.content}
      />
    </main>
  );
}
