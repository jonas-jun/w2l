"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠습니까?")) {
      return;
    }

    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("posts")
      .update({ status: "DELETED", deleted_at: new Date().toISOString() })
      .eq("id", postId);

    setDeleting(false);

    if (error) {
      alert("삭제에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="rounded border border-red-400 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
    >
      삭제
    </button>
  );
}
