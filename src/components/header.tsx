"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Disc3, History, Users, Play } from "lucide-react";

const LINKS = [
  { href: "/lobby", label: "Лобби", icon: Users },
  { href: "/history", label: "История", icon: History },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-neon to-viol shadow-[0_0_24px_rgba(255,46,136,0.45)] transition-transform duration-500 group-hover:rotate-180">
            <Disc3 className="size-5 text-white" />
          </span>
          <span className="font-display text-sm font-bold tracking-wide uppercase sm:text-base">
            Чей <span className="text-grad">трек?</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          <Link
            href="/play"
            className="ml-1 flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-viol px-4 py-2 text-sm font-semibold shadow-[0_0_20px_rgba(255,46,136,0.4)] transition-transform hover:scale-[1.04] active:scale-95"
          >
            <Play className="size-4" />
            Играть
          </Link>
        </nav>
      </div>
    </header>
  );
}
