"use client";

// References, from memory because the Mobbin tool was not connected in this
// session: the Airbnb message thread (who and what it is about in the header,
// bubbles grouped by sender with a line between days) and the Luma event chat
// (the host's messages on the left under the host's name, yours on the right).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, Loader2, Lock, Megaphone, RotateCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getConversation,
  listMessages,
  messageError,
  sendMessage,
  setConversationClosed,
  subscribeToMessages,
  type Conversation,
  type Message,
} from "@/lib/db-messages";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { KIND_LABELS, UUID, clockTime, dayLabel, initials, sameDay } from "./message-utils";
import { markInboxRead, refreshInbox } from "./use-inbox";

type Loaded =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; conversation: Conversation | null };

// A message typed here that the database has not confirmed yet.
type Pending = {
  key: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
  error?: string;
};

function composerPlaceholder(conversation: Conversation): string {
  if (conversation.kind === "announcement") return "Announce to everyone registered";
  if (conversation.side === "student") return `Ask ${conversation.counterpart}`;
  if (conversation.side === "team") return `Reply to ${conversation.counterpart}`;
  return `Message ${conversation.counterpart}`;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/messages"
      aria-label="All messages"
      className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "-ml-1.5 shrink-0 md:hidden")}
    >
      <ArrowLeft aria-hidden />
    </Link>
  );
}

function Bubble({
  mine,
  first,
  last,
  fresh,
  dimmed,
  children,
}: {
  mine: boolean;
  first: boolean;
  last: boolean;
  fresh: boolean;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "w-fit max-w-[80%] rounded-2xl px-3.5 py-2 text-[0.9375rem] leading-snug break-words whitespace-pre-wrap sm:max-w-[70%]",
        mine ? "self-end bg-primary text-primary-foreground" : "bg-secondary text-foreground",
        // A run of messages from one sender reads as one block.
        mine ? !first && "rounded-tr-md" : !first && "rounded-tl-md",
        mine ? !last && "rounded-br-md" : !last && "rounded-bl-md",
        fresh &&
          "animate-in duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] fade-in-0 slide-in-from-bottom-1 motion-reduce:slide-in-from-bottom-0",
        dimmed && "opacity-60",
      )}
    >
      {children}
    </p>
  );
}

// One conversation: header, the messages, and a composer when the reader may write.
export function Thread({ id }: { id: string }) {
  const valid = UUID.test(id);
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  // Messages on screen at the first load do not animate in. Later ones do.
  const [firstIds, setFirstIds] = useState<Set<string> | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const [closing, setClosing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const scroller = useRef<HTMLDivElement>(null);
  // True while the reader is at the newest message, so new ones keep it in view.
  const stick = useRef(true);
  const lastSeen = useRef<string | null>(null);
  const keys = useRef(0);
  // Sends go out one at a time, so quick messages arrive in the order typed.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    const [conversation, list] = await Promise.all([getConversation(id), listMessages(id)]);
    setLoaded({ status: "ready", conversation });
    setFirstIds((current) => current ?? new Set(list.map((item) => item.id)));
    setMessages((current) => {
      // Keep a message sent a moment ago that this read was too early to include.
      const known = new Set(list.map((item) => item.id));
      const newest = list.at(-1)?.createdAt ?? "";
      const extra = current.filter((item) => !known.has(item.id) && item.createdAt > newest);
      return [...list, ...extra];
    });

    const last = list.at(-1);
    if (conversation && last && last.id !== lastSeen.current) {
      if (lastSeen.current && !last.mine && !stick.current) setHasNew(true);
      lastSeen.current = last.id;
      // Reading it here clears the unread dot in the inbox and the sidebar.
      if (!last.mine && document.visibilityState === "visible") markInboxRead(id);
    }
  }, [id]);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    reload().catch(() => {
      if (!cancelled) setLoaded((current) => (current.status === "ready" ? current : { status: "error" }));
    });

    // New messages arrive here. Bursts become one read.
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!cancelled) reload().catch(() => {});
      }, 120);
    };
    const stop = subscribeToMessages(refresh, id);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, valid, reload, attempt]);

  // Stay on the newest message, unless the reader scrolled up to read older ones.
  const count = messages.length + pending.length;
  const ready = loaded.status === "ready";
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [count, ready]);

  function toBottom() {
    stick.current = true;
    setHasNew(false);
    const element = scroller.current;
    if (!element) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: element.scrollHeight, behavior: calm ? "auto" : "smooth" });
  }

  function deliver(item: Pending) {
    queue.current = queue.current.then(() => post(item));
  }

  async function post(item: Pending) {
    try {
      const sent = await sendMessage(id, item.body);
      setPending((current) => current.filter((other) => other.key !== item.key));
      setMessages((current) =>
        current.some((message) => message.id === sent.id)
          ? current
          : [
              ...current,
              { id: sent.id, senderName: "You", mine: true, body: item.body, createdAt: sent.createdAt },
            ],
      );
      lastSeen.current = sent.id;
      refreshInbox();
    } catch (error) {
      setPending((current) =>
        current.map((other) =>
          other.key === item.key
            ? { ...other, status: "failed", error: messageError(error, "Not sent.") }
            : other,
        ),
      );
      // The other side may have closed it meanwhile: show that.
      reload().catch(() => {});
    }
  }

  function send(body: string) {
    keys.current += 1;
    const item: Pending = {
      key: `pending-${keys.current}`,
      body,
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    stick.current = true;
    setHasNew(false);
    setPending((current) => [...current, item]);
    deliver(item);
  }

  function retry(item: Pending) {
    const again: Pending = { ...item, status: "sending", error: undefined };
    setPending((current) => current.map((other) => (other.key === item.key ? again : other)));
    deliver(again);
  }

  async function setClosed(closed: boolean) {
    if (closing) return;
    setClosing(true);
    try {
      await setConversationClosed(id, closed);
      await reload();
      refreshInbox();
    } catch (error) {
      toast.error(messageError(error, closed ? "Could not close. Try again." : "Could not reopen. Try again."));
    } finally {
      setClosing(false);
    }
  }

  if (!valid || (loaded.status === "ready" && !loaded.conversation)) {
    return (
      <>
        <header className="flex h-14 shrink-0 items-center border-b px-3 md:hidden">
          <BackLink />
        </header>
        <Centered>
          <h2 className="text-lg font-semibold">Conversation not found</h2>
          <Link href="/messages" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
            All messages
          </Link>
        </Centered>
      </>
    );
  }

  if (loaded.status === "error") {
    return (
      <>
        <header className="flex h-14 shrink-0 items-center border-b px-3 md:hidden">
          <BackLink />
        </header>
        <Centered>
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <TriangleAlert className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <h2 role="alert" className="text-lg font-semibold">
            Could not load this conversation
          </h2>
          <Button
            variant="outline"
            className="h-9 px-4"
            onClick={() => {
              setLoaded({ status: "loading" });
              setAttempt((current) => current + 1);
            }}
          >
            Try again
          </Button>
        </Centered>
      </>
    );
  }

  if (loaded.status === "loading" || !loaded.conversation) {
    return (
      <div aria-busy="true" className="flex min-h-0 flex-1 flex-col">
        <p role="status" className="sr-only">
          Loading conversation
        </p>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b px-3 sm:px-5">
          <BackLink />
          <Skeleton className="size-10 rounded-full motion-reduce:animate-none" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-48 motion-reduce:animate-none" />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-2 px-5 py-5">
          <Skeleton className="h-9 w-56 rounded-2xl motion-reduce:animate-none" />
          <Skeleton className="h-9 w-40 self-end rounded-2xl motion-reduce:animate-none" />
          <Skeleton className="h-9 w-64 rounded-2xl motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  const conversation = loaded.conversation;
  const announcement = conversation.kind === "announcement";
  const canWrite = !conversation.closed && conversation.side !== "audience";
  const about =
    conversation.kind === "help" && conversation.helpRequestId
      ? `/help/${conversation.helpRequestId}`
      : conversation.eventId
        ? `/events/${conversation.eventId}`
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex min-h-16 shrink-0 items-center gap-3 border-b px-3 py-2 sm:px-5">
        <BackLink />
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            announcement ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
          )}
        >
          {announcement ? <Megaphone className="size-[1.125rem]" /> : initials(conversation.counterpart)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[0.9375rem] font-semibold">{conversation.counterpart}</h2>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {about ? (
              <Link
                href={about}
                className="truncate underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {conversation.title}
              </Link>
            ) : (
              <span className="truncate">{conversation.title}</span>
            )}
            <span aria-hidden>·</span>
            {announcement ? (
              <span className="shrink-0">{KIND_LABELS.announcement}</span>
            ) : (
              <span className="flex shrink-0 items-center gap-1">
                <Lock aria-hidden className="size-3" />
                Private
              </span>
            )}
          </p>
        </div>
        {!announcement && !conversation.closed && (
          <Button
            variant="ghost"
            className="h-9 shrink-0 px-3 text-muted-foreground"
            disabled={closing}
            onClick={() => setClosed(true)}
          >
            {closing && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
            Close
          </Button>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scroller}
          onScroll={(event) => {
            const element = event.currentTarget;
            const atEnd = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
            stick.current = atEnd;
            if (atEnd && hasNew) setHasNew(false);
          }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {count === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <p className="font-medium">
                {announcement ? "No announcements yet" : `Say hello to ${conversation.counterpart}`}
              </p>
              {conversation.kind === "question" && (
                <p className="max-w-xs text-sm text-pretty text-muted-foreground">
                  {conversation.side === "student"
                    ? "Only you and the event's team see this."
                    : "Only this student and your team see this."}
                </p>
              )}
            </div>
          ) : (
            <ol
              aria-label="Messages"
              aria-live="polite"
              className="flex min-h-full flex-col justify-end px-3 py-4 sm:px-5"
            >
              {messages.map((message, index) => {
                const before = messages[index - 1];
                const after = messages[index + 1] ?? null;
                const newDay = !before || !sameDay(before.createdAt, message.createdAt);
                const sender = message.mine ? "me" : message.senderName;
                const first =
                  newDay || (before.mine ? "me" : before.senderName) !== sender;
                const last =
                  !after ||
                  !sameDay(after.createdAt, message.createdAt) ||
                  (after.mine ? "me" : after.senderName) !== sender;
                // The last confirmed message still leads into ones being sent.
                const lastOfMine = last && !(message.mine && !after && pending.length > 0);
                return (
                  <li key={message.id} className={cn("flex flex-col", first ? "mt-3" : "mt-0.5")}>
                    {newDay && (
                      <p className="mb-3 self-center text-xs font-medium text-muted-foreground">
                        {dayLabel(message.createdAt)}
                      </p>
                    )}
                    {first && !message.mine && (
                      <p className="mb-1 ml-1 text-xs font-medium text-muted-foreground">
                        {message.senderName}
                      </p>
                    )}
                    <Bubble
                      mine={message.mine}
                      first={first}
                      last={lastOfMine}
                      fresh={!message.mine && firstIds !== null && !firstIds.has(message.id)}
                    >
                      {message.body}
                    </Bubble>
                    {lastOfMine && (
                      <time
                        dateTime={message.createdAt}
                        className={cn(
                          "mt-1 text-[0.6875rem] text-muted-foreground tabular-nums",
                          message.mine ? "mr-1 self-end" : "ml-1",
                        )}
                      >
                        {clockTime(message.createdAt)}
                      </time>
                    )}
                  </li>
                );
              })}
              {pending.map((item, index) => {
                const previous = messages.at(-1);
                const first = index === 0 && !(previous?.mine && sameDay(previous.createdAt, item.createdAt));
                const last = index === pending.length - 1;
                return (
                  <li key={item.key} className={cn("flex flex-col", first ? "mt-3" : "mt-0.5")}>
                    <Bubble mine first={first} last={last || item.status === "failed"} fresh={false} dimmed>
                      {item.body}
                    </Bubble>
                    {item.status === "failed" ? (
                      <p role="alert" className="mt-1 mr-1 flex items-center gap-2 self-end text-xs">
                        <span className="font-medium text-destructive">{item.error}</span>
                        <button
                          type="button"
                          onClick={() => retry(item)}
                          className="flex items-center gap-1 rounded font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <RotateCw aria-hidden className="size-3" />
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPending((current) => current.filter((other) => other.key !== item.key))
                          }
                          className="rounded text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          Remove
                        </button>
                      </p>
                    ) : (
                      last && (
                        <p className="mt-1 mr-1 self-end text-[0.6875rem] text-muted-foreground">
                          Sending
                        </p>
                      )
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {hasNew && (
          <button
            type="button"
            onClick={toBottom}
            className="absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 animate-in items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground shadow-md duration-200 ease-out fade-in-0 slide-in-from-bottom-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:animate-none"
          >
            <ArrowDown aria-hidden className="size-3.5" />
            New message
          </button>
        )}
      </div>

      {canWrite ? (
        <Composer key={id} placeholder={composerPlaceholder(conversation)} onSend={send} />
      ) : (
        <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t px-5 py-2 text-sm text-muted-foreground">
          {conversation.closed ? (
            <>
              <span>This conversation is closed</span>
              {conversation.canReopen && (
                <Button
                  variant="outline"
                  className="h-8 px-3 text-foreground"
                  disabled={closing}
                  onClick={() => setClosed(false)}
                >
                  {closing && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
                  Reopen
                </Button>
              )}
            </>
          ) : (
            <span>Only the host posts here</span>
          )}
        </div>
      )}
    </div>
  );
}
