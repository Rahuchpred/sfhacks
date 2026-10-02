"use client";

// Reference, from memory because the Mobbin tool was not connected in this
// session: Luma's event page updates from the host (a short list of posts,
// newest first, each with its time).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  listEventAnnouncements,
  subscribeToMessages,
  type Announcement,
} from "@/lib/db-messages";
import { cn } from "@/lib/utils";
import { shortTime } from "./message-utils";
import { markInboxRead } from "./use-inbox";

// An event's announcements, live, for someone registered (and for its team).
// Renders nothing when there are none or the reader is not registered.
// limit shows only the newest few, for a ticket.
export function EventAnnouncements({
  eventId,
  limit,
  className,
}: {
  eventId: string;
  limit?: number;
  className?: string;
}) {
  const { user, role } = useAuth();
  const account = role && user ? user.id : null;
  const [loaded, setLoaded] = useState<{ key: string; items: Announcement[] } | null>(null);
  const key = account ? `${account}:${eventId}` : null;

  useEffect(() => {
    if (!key) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () =>
      listEventAnnouncements(eventId).then(
        (items) => {
          if (!active) return;
          setLoaded({ key, items });
          // Seen here counts as read in the inbox too.
          if (items.length > 0 && document.visibilityState === "visible") {
            markInboxRead(items[0].conversationId);
          }
        },
        () => {},
      );
    load();
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 150);
    };
    // Every message this person may read arrives here, so a new announcement shows at once.
    const stop = subscribeToMessages(refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, eventId]);

  const items = loaded && loaded.key === key ? loaded.items : [];
  if (items.length === 0) return null;
  const shown = limit ? items.slice(0, limit) : items;
  const more = items.length - shown.length;

  return (
    <section
      aria-label="Announcements"
      className={cn(
        "animate-in rounded-xl border border-primary/20 bg-secondary/60 p-4 duration-200 ease-out fade-in-0 motion-reduce:animate-none",
        className,
      )}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Megaphone aria-hidden className="size-4" />
        From the host
      </h2>
      <ul className="mt-2 space-y-2.5">
        {shown.map((item) => (
          <li key={item.id} className="text-sm">
            <p className="text-pretty break-words whitespace-pre-wrap">{item.body}</p>
            <time dateTime={item.createdAt} className="text-xs text-muted-foreground tabular-nums">
              {shortTime(item.createdAt)}
            </time>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link
          href={`/messages/${items[0].conversationId}`}
          className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          {more} more
        </Link>
      )}
    </section>
  );
}
