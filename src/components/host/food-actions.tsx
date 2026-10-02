"use client";

// The Mobbin tool was not available this round. The confirm step follows this app's own
// "Cancel event" dialog: one sentence on what happens, a keep button and the action.

import { useRef, useState } from "react";
import { Loader2, RotateCcw, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canClose,
  canReopen,
  closeRescue,
  removeRescue,
  reopenRescue,
  type FoodActionResult,
  type FoodPost,
} from "@/lib/db-food";
import { cn } from "@/lib/utils";
import { formatClock } from "./host-utils";

export type FoodChange = "closed" | "reopened" | "removed";

type Confirming = "close" | "remove";

const ACTION = "h-10 touch-manipulation px-3";
const OFFLINE = "Check your connection and try again.";

function holdsLine(held: number): string {
  if (held <= 0) return "";
  return held === 1
    ? " 1 student is holding a portion. That hold is cancelled, and the student is told."
    : ` ${held} portions are on hold. Those holds are cancelled, and the students are told.`;
}

function cancelledLine(cancelled: number): string | undefined {
  if (cancelled <= 0) return undefined;
  return cancelled === 1 ? "1 hold was cancelled." : `${cancelled} holds were cancelled.`;
}

// "Food is gone", "Reopen" and "Remove post" for one food post.
export function FoodActions({
  post,
  held,
  now,
  onChanged,
  className,
}: {
  post: FoodPost;
  held: number; // holds waiting for pickup, for the confirm text
  now: number;
  onChanged: (change: FoodChange) => void;
  className?: string;
}) {
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  // Kept while the dialog fades out, so its text does not switch mid-animation.
  const [shown, setShown] = useState<Confirming>("close");
  const [pending, setPending] = useState<"close" | "remove" | "reopen" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A ref, because two clicks can land before the pending state re-renders.
  const busy = useRef(false);

  const safeClock = formatClock(post.safeUntil);

  function ask(kind: Confirming) {
    setError(null);
    setShown(kind);
    setConfirming(kind);
  }

  // True when the post is settled either way, so the dialog can close.
  function settle(result: FoodActionResult, change: FoodChange, done: string): boolean {
    if (result.ok) {
      toast.success(done, { description: cancelledLine(result.cancelled) });
      onChanged(change);
      return true;
    }
    if (result.reason === "not_found") {
      toast("This post was already removed");
      onChanged("removed");
      return true;
    }
    return false;
  }

  async function run(kind: Confirming) {
    if (busy.current) return;
    busy.current = true;
    setPending(kind);
    setError(null);
    try {
      const result =
        kind === "close" ? await closeRescue(post.id) : await removeRescue(post.id);
      if (settle(result, kind === "close" ? "closed" : "removed", kind === "close" ? "Post closed" : "Post removed")) {
        setConfirming(null);
      } else {
        setError("You cannot manage this food post.");
      }
    } catch {
      setError(`Could not ${kind === "close" ? "close" : "remove"} the post. ${OFFLINE}`);
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function reopen() {
    if (busy.current) return;
    busy.current = true;
    setPending("reopen");
    try {
      const result = await reopenRescue(post.id);
      if (settle(result, "reopened", "Post reopened")) return;
      toast.error(
        result.reason === "expired"
          ? "Past its safe-until time, so it cannot be reopened."
          : "You cannot manage this food post.",
      );
    } catch {
      toast.error(`Could not reopen the post. ${OFFLINE}`);
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  const closing = shown === "close";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {canClose(post, now) && (
        <Button
          type="button"
          variant="outline"
          className={ACTION}
          disabled={pending !== null}
          onClick={() => ask("close")}
        >
          <UtensilsCrossed aria-hidden="true" />
          Food is gone
        </Button>
      )}
      {canReopen(post, now) && (
        <Button
          type="button"
          variant="outline"
          className={ACTION}
          disabled={pending !== null}
          onClick={reopen}
        >
          {pending === "reopen" ? (
            <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <RotateCcw aria-hidden="true" />
          )}
          <span aria-live="polite">{pending === "reopen" ? "Reopening…" : "Reopen"}</span>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        className={cn(ACTION, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
        disabled={pending !== null}
        onClick={() => ask("remove")}
      >
        <Trash2 aria-hidden="true" />
        Remove post
      </Button>

      <Dialog
        open={confirming !== null}
        onOpenChange={(next) => {
          // Stay open while the request is in flight.
          if (pending || next) return;
          setConfirming(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{closing ? "Mark the food as gone?" : "Remove this post?"}</DialogTitle>
            <DialogDescription className="text-pretty tabular-nums">
              {closing
                ? `"${post.items}" leaves the Free food page.${safeClock ? ` You can reopen it until ${safeClock}.` : ""}`
                : `"${post.items}" and its pickup history are deleted. This cannot be undone.`}
              {holdsLine(held)}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-pretty break-words text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              className="h-10 px-4"
              disabled={pending !== null}
              onClick={() => setConfirming(null)}
            >
              Keep post
            </Button>
            <Button
              variant={closing ? "default" : "destructive"}
              size="lg"
              className="h-10 px-4"
              disabled={pending !== null}
              onClick={() => run(shown)}
            >
              {pending !== null && (
                <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              )}
              <span aria-live="polite">
                {closing
                  ? pending
                    ? "Closing…"
                    : "Food is gone"
                  : pending
                    ? "Removing…"
                    : "Remove post"}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
