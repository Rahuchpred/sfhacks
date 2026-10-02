import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

type LiveNumbersProps = {
  eventCount: number;
  rescueCount: number;
  loading: boolean;
  error: string | null;
};

const statClass =
  "group flex min-w-0 flex-col gap-1 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

// Real counts only. Hidden when the data could not load.
export function LiveNumbers({
  eventCount,
  rescueCount,
  loading,
  error,
}: LiveNumbersProps) {
  if (error) return null;

  if (loading) {
    return (
      <div role="status" className="flex gap-10">
        <span className="sr-only">Loading campus numbers…</span>
        {[0, 1].map((index) => (
          <div key={index} aria-hidden className="space-y-2">
            <Skeleton className="h-9 w-12" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className="flex flex-wrap gap-x-10 gap-y-4">
      <li className="min-w-0">
        <Link href="/map" className={statClass}>
          <span className="text-4xl font-semibold tracking-tight text-primary tabular-nums">
            {eventCount}
          </span>
          <span className="text-sm text-muted-foreground group-hover:text-foreground">
            {eventCount === 0
              ? "no upcoming events yet"
              : eventCount === 1
                ? "upcoming event"
                : "upcoming events"}
          </span>
        </Link>
      </li>
      <li className="min-w-0">
        <Link href="/food" className={statClass}>
          <span className="flex items-center gap-2 text-4xl font-semibold tracking-tight text-primary tabular-nums">
            {rescueCount}
            <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          </span>
          <span className="text-sm text-muted-foreground group-hover:text-foreground">
            {rescueCount === 0
              ? "no open food posts right now"
              : rescueCount === 1
                ? "open food post"
                : "open food posts"}
          </span>
        </Link>
      </li>
    </ul>
  );
}
