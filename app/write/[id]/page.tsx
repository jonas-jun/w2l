import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PostForm from "@/components/PostForm";
import { toContentFormat } from "@/lib/posts";

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
    .select("id, title, content, content_format, author_id, status")
    .eq("id", id)
    .maybeSingle();

  // 삭제된 글은 편집 URL로 직접 들어와도 되살릴 수 없다.
  if (!post || post.status === "DELETED") {
    notFound();
  }

  if (post.author_id !== user.id) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold">
        {post.status === "DRAFT" ? "임시저장한 글" : "글 수정"}
      </h1>
      <PostForm
        mode="edit"
        postId={post.id}
        initialTitle={post.title}
        initialContent={post.content}
        initialFormat={toContentFormat(post.content_format)}
        initialStatus={post.status}
      />
    </main>
  );
}
