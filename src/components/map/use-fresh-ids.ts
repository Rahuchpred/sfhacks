"use client";

import { useState } from "react";

const FRESH_MS = 30_000;

// Returns the ids that appeared after the first load, for about 30 seconds each.
// Used to make a newly published event or rescue noticeable.
export function useFreshIds(ids: string[], ready: boolean, now: number): ReadonlySet<string> {
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null);
  const [expiry, setExpiry] = useState<Readonly<Record<string, number>>>({});

  // Derived state, adjusted during render when the id list changes.
  if (ready) {
    if (seen === null) {
      setSeen(new Set(ids));
    } else {
      const added = ids.filter((id) => !seen.has(id));
      if (added.length > 0) {
        setSeen(new Set([...seen, ...added]));
        setExpiry({
          ...expiry,
          ...Object.fromEntries(added.map((id) => [id, now + FRESH_MS])),
        });
      }
    }
  }

  return new Set(Object.keys(expiry).filter((id) => expiry[id] > now));
}
