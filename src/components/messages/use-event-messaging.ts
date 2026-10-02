"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getEventMessaging, type EventMessaging } from "@/lib/db-messages";

// What the signed-in person may do with messages on one event. Null until known,
// and null when it could not be read (the entry points then stay hidden).
export function useEventMessaging(eventId: string): EventMessaging | null {
  const { user, role, ready } = useAuth();
  const account = ready && user ? `${user.id}:${role ?? ""}` : null;
  const [known, setKnown] = useState<{ key: string; value: EventMessaging | null } | null>(null);
  const key = account ? `${account}:${eventId}` : null;

  useEffect(() => {
    if (!key) return;
    let active = true;
    getEventMessaging(eventId).then(
      (value) => {
        if (active) setKnown({ key, value });
      },
      () => {
        if (active) setKnown({ key, value: null });
      },
    );
    return () => {
      active = false;
    };
  }, [key, eventId]);

  return known && known.key === key ? known.value : null;
}
