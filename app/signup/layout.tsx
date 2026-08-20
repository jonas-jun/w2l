import type { Metadata } from "next";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupLayout({ children }: LayoutProps<"/signup">) {
  return children;
}
