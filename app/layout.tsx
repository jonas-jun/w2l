import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "어디살래?";
const SITE_DESCRIPTION =
  "지역·아파트·생활권을 비교하고 토론하는 부동산 커뮤니티.";

export const metadata: Metadata = {
  // 하위 페이지는 "글 제목 · 어디살래?" 형태가 된다.
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 모바일에서 확대를 막지 않는다 (접근성).
  maximumScale: 5,
  // 주소창까지 배경색과 맞춰야 화면 상단의 흰 띠가 남지 않는다 (issue #4).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf6e3" },
    { media: "(prefers-color-scheme: dark)", color: "#002b36" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col pb-16">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
