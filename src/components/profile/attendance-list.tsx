import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/components/profile/profile-utils";
import type { TicketWithEvent } from "@/lib/types";

const linkClass =
  "rounded-sm font-medium text-primary underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50";

// The heart of the profile: every event a club checked this student into.
export function AttendanceList({ attended }: { attended: TicketWithEvent[] }) {
  if (attended.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed px-4 py-6">
        <p className="text-sm font-medium">No check-ins yet</p>
        <p className="text-sm text-muted-foreground">
          <Link href="/map" className={linkClass}>
            Find an event
          </Link>{" "}
          or see{" "}
          <Link href="/tickets" className={linkClass}>
            your tickets
          </Link>
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {attended.map(({ id, event }) => (
        <li key={id} className="flex min-w-0 gap-3 px-4 py-3.5">
          <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-col gap-x-4 gap-y-0.5 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="min-w-0 text-base leading-snug font-medium break-words">
                <Link
                  href={`/events/${event.id}`}
                  className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {event.title}
                </Link>
              </h3>
              <time
                dateTime={event.startsAt}
                className="shrink-0 text-sm text-muted-foreground tabular-nums"
              >
                {formatEventDate(event.startsAt)}
              </time>
            </div>
            {event.clubName && (
              <p className="min-w-0 text-sm break-words text-muted-foreground">{event.clubName}</p>
            )}
            {event.tags.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Tags">
                {event.tags.map((tag) => (
                  <li key={tag}>
                    <Badge variant="secondary">{tag}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
