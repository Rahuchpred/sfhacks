"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/food", label: "Free food" },
  { href: "/post", label: "Post" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-8 bg-primary px-4 text-primary-foreground sm:px-6">
        <Link href="/map" className="flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="size-2.5 rounded-full bg-accent" aria-hidden />
          <span className="text-base font-semibold tracking-tight">Gator Radar</span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-white",
                  active
                    ? "bg-white/15 text-white"
                    : "text-primary-foreground/75 hover:bg-white/10 hover:text-white",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <span className="ml-auto hidden text-sm text-primary-foreground/70 sm:block">
          San Francisco State University
        </span>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
