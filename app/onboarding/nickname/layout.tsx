import type { Metadata } from "next";

export const metadata: Metadata = { title: "닉네임 설정" };

export default function NicknameLayout({ children }: LayoutProps<"/onboarding/nickname">) {
  return children;
}
