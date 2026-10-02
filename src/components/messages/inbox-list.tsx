"use client";

// References, from memory because the Mobbin tool was not connected in this
// session: the Airbnb messages inbox (filter chips above the list, a row with
// an avatar, the name, what the thread is about, a one line preview and the
// time) and the Intercom inbox (unread rows in bold with a dot on the right).

import { useState } from "react";
import Link from "next/link";
import { HandHelping, Megaphone, MessagesSquare, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation, ConversationKind } from "@/lib/db-messages";
import { cn } from "@/lib/utils";
import { initials, shortTime } from "./message-utils";
import { retryInbox, useInbox } from "./use-inbox";

type Filter = "all" | ConversationKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "question", label: "Events" },
  { value: "announcement", label: "Announcements" },
  { value: "help", label: "Help" },
];

function Avatar({ conversation }: { conversation: Conversation }) {
  const base = "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold";
  if (conversation.kind === "announcement") {
    return (
      <span aria-hidden className={cn(base, "bg-primary text-primary-foreground")}>
        <Megaphone className="size-[1.125rem]" />
      </span>
    );
  }
  if (conversation.kind === "help") {
    return (
      <span aria-hidden className={cn(base, "bg-accent/20 text-accent-foreground")}>
        <HandHelping className="size-[1.125rem]" />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(base, "bg-secondary text-primary")}>
      {initials(conversation.counterpart)}
    </span>
  );
}

function Row({ conversation, active }: { conversation: Conversation; active: boolean }) {
  const { unread } = conversation;
  return (
    <Link
      href={`/messages/${conversation.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex gap-3 rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
        active && "bg-secondary",
      )}
    >
      <Avatar conversation={conversation} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
            {conversation.counterpart}
          </p>
          {conversation.lastAt && (
            <time
              dateTime={conversation.lastAt}
              className={cn(
                "shrink-0 text-xs tabular-nums",
                unread ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {shortTime(conversation.lastAt)}
            </time>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {conversation.title}
          {conversation.closed && ", closed"}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              unread ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {conversation.lastMine && "You: "}
            {conversation.lastBody}
          </p>
          {unread && (
            <span className="size-2.5 shrink-0 rounded-full bg-primary">
              <span className="sr-only">Unread</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-1 px-2">
      <p role="status" className="sr-only">
        Loading messages
      </p>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex gap-3 px-3 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full motion-reduce:animate-none" />
          <div className="flex-1 space-y-2 py-0.5">
            <Skeleton className="h-3.5 w-2/5 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-3/5 motion-reduce:animate-none" />
            <Skeleton className="h-3.5 w-4/5 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

// The inbox: every conversation, newest first, with a filter by kind.
export function InboxList({ activeId }: { activeId: string | null }) {
  const { status, conversations } = useInbox();
  const [filter, setFilter] = useState<Filter>("all");
  const shown =
    filter === "all" ? conversations : conversations.filter((item) => item.kind === filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 px-5 pt-5 pb-3">
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => {
            const unread = conversations.filter(
              (conversation) =>
                conversation.unread && (item.value === "all" || conversation.kind === item.value),
            ).length;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.8125rem] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.97] motion-reduce:transition-none",
                  filter === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-secondary",
                )}
              >
                {item.label}
                {unread > 0 && (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      filter === item.value ? "text-primary-foreground/80" : "text-primary",
                    )}
                  >
                    {unread}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {status === "loading" ? (
          <ListSkeleton />
        ) : status === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <TriangleAlert className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <h2 className="font-semibold">Could not load messages</h2>
            <Button variant="outline" className="h-9 px-4" onClick={retryInbox}>
              Try again
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
              <MessagesSquare className="size-6 text-primary" aria-hidden />
            </div>
            <h2 className="font-semibold">
              {conversations.length === 0 ? "No messages yet" : "Nothing here"}
            </h2>
            {conversations.length === 0 && (
              <>
                <p className="text-sm text-pretty text-muted-foreground">
                  Ask a host a question from any event page.
                </p>
                <Link href="/map" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
                  Find an event
                </Link>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5 px-2">
            {shown.map((conversation) => (
              <li key={conversation.id}>
                <Row conversation={conversation} active={conversation.id === activeId} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
