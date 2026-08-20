"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export interface UploadedImage {
  storagePath: string;
  publicUrl: string;
}

interface ImageUploadButtonProps {
  onUploaded: (image: UploadedImage) => void;
  onError: (message: string) => void;
}

export default function ImageUploadButton({
  onUploaded,
  onError,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 change가 발생하도록 값을 비운다.
    e.target.value = "";
    if (!file) return;

    // 아래 두 검증은 UX용이다 — 실제 강제는 버킷의 file_size_limit/allowed_mime_types가 한다.
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      onError("이미지 파일(JPEG, PNG, GIF, WebP)만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onError("이미지는 5MB 이하만 업로드할 수 있습니다.");
      return;
    }

    setUploading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUploading(false);
      onError("로그인이 필요합니다.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    // 업로드 경로는 `<uid>/...`여야 Storage 정책을 통과한다.
    const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(storagePath, file, { contentType: file.type });

    setUploading(false);

    if (uploadError) {
      onError("이미지 업로드에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("post-images").getPublicUrl(storagePath);

    onUploaded({ storagePath, publicUrl });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded border border-black/20 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/20"
        aria-label="이미지"
      >
        {uploading ? "업로드 중..." : "이미지"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        onChange={handleChange}
        className="hidden"
        data-testid="image-file-input"
      />
    </>
  );
}
