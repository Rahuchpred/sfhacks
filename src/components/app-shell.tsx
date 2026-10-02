"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/food", label: "Free food" },
  { href: "/tickets", label: "Tickets" },
  { href: "/host", label: "Host" },
  { href: "/post", label: "Post" },
  { href: "/recruiters", label: "Recruiters" },
];

function navClass(active: boolean): string {
  return cn(
    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-white",
    active ? "bg-white/15 text-white" : "text-primary-foreground/75 hover:bg-white/10 hover:text-white",
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 bg-primary px-4 text-primary-foreground sm:gap-8 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="size-2.5 rounded-full bg-accent" aria-hidden />
          <span className="text-base font-semibold tracking-tight">Gator Radar</span>
        </Link>

        {/* Scrolls sideways on a phone instead of wrapping or hiding links. */}
        <nav
          aria-label="Main"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
        >
          {NAV.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={navClass(active)}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/profile"
          aria-current={pathname.startsWith("/profile") ? "page" : undefined}
          className={cn(navClass(pathname.startsWith("/profile")), "flex items-center gap-1.5")}
        >
          <CircleUser className="size-4" aria-hidden />
          <span className="hidden sm:inline">Profile</span>
          <span className="sr-only sm:hidden">Profile</span>
        </Link>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
