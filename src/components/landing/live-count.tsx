"use client";

import { useEffect, useState } from "react";
import { listUpcomingEvents } from "@/lib/db";

// The one true number on the page. Shows nothing while loading, on an error,
// or when there are no events, and keeps its height so the headline never moves.
export function LiveCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listUpcomingEvents()
      .then((events) => {
        if (!cancelled) setCount(events.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = count !== null && count > 0;

  return (
    <p
      aria-live="polite"
      className="flex h-5 items-center gap-2 text-sm font-medium text-muted-foreground transition-opacity duration-300 ease-out motion-reduce:transition-none"
      style={{ opacity: shown ? 1 : 0 }}
    >
      {shown && (
        <>
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          <span className="tabular-nums">
            {count} {count === 1 ? "event" : "events"} coming up
          </span>
        </>
      )}
    </p>
  );
}
