import Link from "next/link";
import { Lock, SearchX, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { HostEventStatus } from "./use-host-event";

function Message({
  icon: Icon,
  title,
  body,
  alert,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
  alert?: boolean;
}) {
  return (
    <div
      role={alert ? "alert" : undefined}
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold text-balance">{title}</h1>
      <p className="text-sm text-pretty break-words text-muted-foreground">{body}</p>
      <Link href="/host" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}>
        Back to your events
      </Link>
    </div>
  );
}

// Renders children only for the event's host. Every other case gets one plain screen.
export function HostGate({
  status,
  error,
  children,
}: {
  status: HostEventStatus;
  error: string | null;
  children: React.ReactNode;
}) {
  if (status === "ready") return children;

  if (status === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <p role="status" className="sr-only">
          Loading event
        </p>
        <Skeleton className="h-8 w-2/3 motion-reduce:animate-none" />
        <Skeleton className="h-4 w-1/2 motion-reduce:animate-none" />
        <Skeleton className="h-40 w-full motion-reduce:animate-none" />
      </div>
    );
  }

  if (status === "not_host") {
    return (
      <Message
        icon={Lock}
        title="This is not your event"
        body="Only the person who posted an event can manage it or check guests in."
      />
    );
  }

  if (status === "not_found") {
    return (
      <Message
        icon={SearchX}
        title="Event not found"
        body="It may have been canceled, or the link is wrong."
      />
    );
  }

  return (
    <Message
      icon={TriangleAlert}
      title="Could not load this event"
      body={error ?? "Check your connection and reload the page."}
      alert
    />
  );
}
