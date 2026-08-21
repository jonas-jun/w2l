"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LikeButtonProps {
  postId: string;
  initialLikeCount: number;
  initialLiked: boolean;
  userId: string | null;
}

export default function LikeButton({
  postId,
  initialLikeCount,
  initialLiked,
  userId,
}: LikeButtonProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!userId) {
      router.push("/login");
      return;
    }

    setPending(true);
    const supabase = createClient();

    if (liked) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      setPending(false);
      if (!error) {
        setLiked(false);
        setLikeCount((c) => c - 1);
      }
      return;
    }

    const { error } = await supabase.from("post_likes").insert({ post_id: postId });

    setPending(false);
    if (!error) {
      setLiked(true);
      setLikeCount((c) => c + 1);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`rounded border px-3 py-1.5 text-sm disabled:opacity-50 ${
        liked
          ? "border-danger bg-danger-bg text-danger"
          : "border-border"
      }`}
    >
      추천 {likeCount}
    </button>
  );
}
