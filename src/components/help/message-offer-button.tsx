"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { messageError, openHelpConversation } from "@/lib/db-messages";
import { cn } from "@/lib/utils";

// Opens the chat of an accepted or done offer, for the requester or the student.
export function MessageOfferButton({ offerId, className }: { offerId: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const id = await openHelpConversation(offerId);
      router.push(`/messages/${id}`);
    } catch (error) {
      toast.error(messageError(error, "Could not open the chat. Try again."));
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" className={cn("h-9 px-3", className)} disabled={busy} onClick={open}>
      {busy ? (
        <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
      ) : (
        <MessageCircle aria-hidden />
      )}
      Message
    </Button>
  );
}
