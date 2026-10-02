"use client";

// Reference, from memory because the Mobbin tool was not connected in this
// session: the Airbnb and Intercom web inboxes, a fixed list on the left and
// the open thread on the right. On a phone only one of the two is on screen.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { welcomeHref } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { InboxList } from "./inbox-list";

export function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, ready } = useAuth();
  const activeId = pathname.match(/^\/messages\/([^/]+)/)?.[1] ?? null;

  // The page guard does not know /messages yet, so a guest is sent to sign in here.
  const guest = ready && !role;
  useEffect(() => {
    if (guest) router.replace(welcomeHref(pathname));
  }, [guest, pathname, router]);

  if (!ready || guest) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6" aria-busy="true">
        <p role="status" className="sr-only">
          Loading
        </p>
        <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-40 w-full rounded-xl motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    // The shell's main area scrolls. This fills it, and each pane scrolls on its own.
    <div className="absolute inset-0 flex">
      <aside
        aria-label="Conversations"
        className={cn(
          "min-h-0 w-full shrink-0 flex-col md:flex md:w-[22rem] md:border-r",
          activeId ? "hidden" : "flex",
        )}
      >
        <InboxList activeId={activeId} />
      </aside>
      <section
        aria-label="Conversation"
        className={cn("min-h-0 min-w-0 flex-1 flex-col md:flex", activeId ? "flex" : "hidden")}
      >
        {children}
      </section>
    </div>
  );
}
