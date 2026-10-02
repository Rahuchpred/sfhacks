"use client";

// The Mobbin tool was not available this round. The layout follows this app's own host
// dashboard (one card per row, facts on the left, actions under them) and the pickup
// desk's DoorDash Merchant "Orders" reference for the status badge and counts.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Loader2, Plus, TriangleAlert, Utensils } from "lucide-react";
import { useUser } from "@/components/auth-provider";
import { useNow } from "@/components/food/countdown";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { releaseExpiredClaims, subscribeToCampus } from "@/lib/db";
import {
  FOOD_POST_LABELS,
  foodPostState,
  listHostFoodEvents,
  listHostFoodPosts,
  type HostFoodPost,
} from "@/lib/db-food";
import type { CampusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FoodActions, type FoodChange } from "./food-actions";
import { GOLD_BUTTON } from "./food-utils";
import { formatClock } from "./host-utils";

// Holds run out on their own, with no database change to listen for.
const POLL_MS = 15_000;
const PULSE = "motion-reduce:animate-none";

type Loaded = { posts: HostFoodPost[]; events: CampusEvent[] };
type State = { data: Loaded | null; error: boolean };

async function fetchBoard(): Promise<Loaded> {
  // Run-out holds go back on the list first, so "left" is right. Fine if it fails.
  await releaseExpiredClaims().catch(() => 0);
  const [posts, events] = await Promise.all([listHostFoodPosts(), listHostFoodEvents()]);
  return { posts, events };
}

// Picks the event the food is left over from, then opens that event's food page.
function PostFood({ events, large }: { events: CampusEvent[]; large?: boolean }) {
  const now = useNow(30_000);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              GOLD_BUTTON,
              "touch-manipulation text-base",
              large ? "h-12 px-6" : "h-11 px-4",
            )}
          />
        }
      >
        <Plus aria-hidden="true" />
        Post food
        <ChevronDown aria-hidden="true" className="opacity-70" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] gap-1 p-2">
        {events.length === 0 ? (
          <div className="flex flex-col gap-2 p-2 text-sm">
            <p className="font-medium">No event running</p>
            <p className="text-pretty text-muted-foreground">
              Food is posted from an event that has started, up to 12 hours after it ends.
            </p>
            <Link
              href="/host"
              className={cn(buttonVariants({ variant: "outline" }), "mt-1 h-10 px-3")}
            >
              Your events
            </Link>
          </div>
        ) : (
          <>
            <p className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">
              Which event is it from?
            </p>
            <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {events.map((event) => {
                const live = Date.parse(event.endsAt) > now;
                return (
                  <li key={event.id}>
                    <Link
                      href={`/host/${event.id}/food?post=1`}
                      className="flex min-h-11 touch-manipulation items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium break-words">{event.title}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {live ? "Live now" : `Ended ${formatClock(event.endsAt)}`}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PostRow({
  post,
  now,
  onChanged,
}: {
  post: HostFoodPost;
  now: number;
  onChanged: (post: HostFoodPost, change: FoodChange) => void;
}) {
  const state = foodPostState(post, now);
  const open = state === "open";
  const safeClock = formatClock(post.safeUntil);

  return (
    <li>
      <article
        className={cn(
          "flex flex-col gap-3 rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10",
          open && "shadow-md",
        )}
      >
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.photoUrl}
            alt=""
            width={64}
            height={64}
            loading="lazy"
            className={cn("size-16 shrink-0 rounded-lg bg-muted object-cover", !open && "opacity-60")}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="line-clamp-2 min-w-0 text-base leading-snug font-medium break-words">
                {post.items}
              </h2>
              <Badge
                variant={open ? "default" : "secondary"}
                className={cn("shrink-0", open && "bg-accent text-accent-foreground")}
              >
                {FOOD_POST_LABELS[state]}
              </Badge>
            </div>
            {post.eventTitle && (
              <p className="truncate text-muted-foreground">From {post.eventTitle}</p>
            )}
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground tabular-nums">
              <span>
                <span className="font-medium text-foreground">
                  {post.portionsLeft} of {post.portions}
                </span>{" "}
                left
              </span>
              <span>
                <span className={cn("font-medium", post.held > 0 && "text-foreground")}>
                  {post.held}
                </span>{" "}
                {post.held === 1 ? "hold" : "holds"} waiting
              </span>
              <span>{post.pickedUp} picked up</span>
              {safeClock && <span>Safe until {safeClock}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {post.eventId && (
            <Link
              href={`/host/${post.eventId}/food`}
              aria-label={`Pickup desk for ${post.items}`}
              className={cn(
                buttonVariants({ variant: open ? "default" : "outline" }),
                "h-10 touch-manipulation px-3",
                open && GOLD_BUTTON,
              )}
            >
              Pickup desk
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
          <FoodActions
            post={post}
            held={post.held}
            now={now}
            onChanged={(change) => onChanged(post, change)}
            // Its buttons wrap in the same row as "Pickup desk".
            className="contents"
          />
        </div>
      </article>
    </li>
  );
}

export function FoodBoard() {
  const userId = useUser()?.id ?? null;
  const now = useNow(1000);
  const [state, setState] = useState<State>({ data: null, error: false });
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    // Before sign-in finishes the list would come back empty.
    if (!userId) return;
    try {
      const data = await fetchBoard();
      setState({ data, error: false });
    } catch {
      // A failed refresh keeps the last good list on screen.
      setState((current) => ({ ...current, error: true }));
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void load();
    };
    run();
    const unsubscribe = subscribeToCampus(run);
    const poll = window.setInterval(run, POLL_MS);
    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [load]);

  function handleChanged(post: HostFoodPost, change: FoodChange) {
    // A removed post leaves at once. The reload brings the rest.
    if (change === "removed") {
      setState((current) =>
        current.data
          ? {
              ...current,
              data: {
                ...current.data,
                posts: current.data.posts.filter((item) => item.id !== post.id),
              },
            }
          : current,
      );
    }
    void load();
  }

  const { data, error } = state;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-balance">Leftover food</h1>
        {data && data.posts.length > 0 && <PostFood events={data.events} />}
      </header>

      {!data && !error && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <p role="status" className="sr-only">
            Loading your food posts
          </p>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className={cn("h-32 w-full rounded-xl", PULSE)} />
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm",
            !data && "flex-col py-10 text-center",
          )}
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1 text-pretty">
            {data ? "Could not refresh, so this list may be out of date." : "Could not load your food posts."}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-10 touch-manipulation px-4"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await load();
              setRetrying(false);
            }}
          >
            {retrying && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            Try again
          </Button>
        </div>
      )}

      {data && data.posts.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent/20 text-accent-foreground">
            <Utensils aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold text-balance">No food posted yet</h2>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            Food is posted from an event that has started. Pick the event, add one photo, and
            students can hold a portion.
          </p>
          <div className="mt-1">
            <PostFood events={data.events} large />
          </div>
        </div>
      )}

      {data && data.posts.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.posts.map((post) => (
            <PostRow key={post.id} post={post} now={now} onChanged={handleChanged} />
          ))}
        </ul>
      )}
    </div>
  );
}
