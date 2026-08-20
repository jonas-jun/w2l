"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "홈" },
  { href: "/popular", label: "인기" },
  { href: "/write", label: "글쓰기" },
  { href: "/profile", label: "프로필" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-black/[.08] bg-[var(--background)] dark:border-white/[.145]">
      <div className="mx-auto flex max-w-[640px] items-stretch justify-around">
        {TABS.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-sm ${
                active
                  ? "font-semibold text-[var(--foreground)]"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
