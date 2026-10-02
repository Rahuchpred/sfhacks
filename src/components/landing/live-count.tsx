import { cn } from "@/lib/utils";

// The one true number on the page. Shows nothing while loading, on an error,
// or when there are no events, and keeps its height so the headline never moves.
export function LiveCount({ count, className }: { count: number; className?: string }) {
  const shown = count > 0;

  return (
    <p
      aria-live="polite"
      className={cn(
        "flex h-5 items-center gap-2 text-sm font-medium transition-opacity duration-300 ease-out motion-reduce:transition-none",
        shown ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {shown && (
        <>
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          <span className="tabular-nums">
            {count} {count === 1 ? "event" : "events"} coming up
          </span>
        </>
      )}
    </p>
  );
}
