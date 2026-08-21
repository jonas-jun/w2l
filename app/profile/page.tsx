import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { formatRelativeTime } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "프로필",
  description: "내 정보와 임시저장한 글.",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: drafts }] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", user.id).single(),
    supabase
      .from("posts")
      .select("id, title, updated_at")
      .eq("author_id", user.id)
      .eq("status", "DRAFT")
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">{profile?.nickname}</p>
        <SignOutButton />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">
          임시저장 {drafts?.length ?? 0}
        </h2>
        {drafts && drafts.length > 0 ? (
          <div>
            {drafts.map((draft) => (
              <Link
                key={draft.id}
                href={`/write/${draft.id}`}
                className="flex flex-col gap-1 border-b border-border/40 py-3"
              >
                <p className="font-medium">
                  {draft.title.trim().length > 0 ? draft.title : "(제목 없음)"}
                </p>
                <span className="text-xs text-muted">
                  {formatRelativeTime(draft.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            임시저장한 글이 없습니다.
          </p>
        )}
      </section>
    </main>
  );
}
