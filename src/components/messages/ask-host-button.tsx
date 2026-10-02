"use client";

// Reference, from memory because the Mobbin tool was not connected in this
// session: Luma's "Contact the host" link on an event page, one quiet button
// that opens a private conversation.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useRequireAccount } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { messageError, openEventConversation } from "@/lib/db-messages";
import { cn } from "@/lib/utils";
import { useEventMessaging } from "./use-event-messaging";

// Opens (or starts) the student's private conversation with the event's team.
// Hidden from the team itself and on events nobody hosts. A guest signs in first.
export function AskHostButton({ eventId, className }: { eventId: string; className?: string }) {
  const router = useRouter();
  const { role } = useAuth();
  const requireAccount = useRequireAccount();
  const messaging = useEventMessaging(eventId);
  const [busy, setBusy] = useState(false);

  if (!messaging || !messaging.hasHost || messaging.isTeam) return null;

  async function ask() {
    if (busy || !requireAccount()) return;
    setBusy(true);
    try {
      const id = await openEventConversation(eventId);
      router.push(`/messages/${id}`);
    } catch (error) {
      toast.error(messageError(error, "Could not open the conversation. Try again."));
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      className={cn(
        "h-10 animate-in px-4 duration-200 ease-out fade-in-0 motion-reduce:animate-none",
        className,
      )}
      disabled={busy}
      onClick={ask}
    >
      {busy ? (
        <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
      ) : (
        <MessageCircle aria-hidden />
      )}
      {role ? "Ask the host" : "Sign in to ask the host"}
    </Button>
  );
}
