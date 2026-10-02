import { cn } from "@/lib/utils";
import type { CampusEvent } from "@/lib/types";

type EventCoverProps = {
  event: Pick<CampusEvent, "title" | "clubName" | "flyerUrl">;
  className?: string;
};

// The flyer, or a generated purple cover when the event has none.
export function EventCover({ event, className }: EventCoverProps) {
  if (event.flyerUrl) {
    return (
      // Flyers are user uploads on Supabase storage, so the size is not known ahead of time.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={event.flyerUrl}
        alt={`Flyer for ${event.title}`}
        width={640}
        height={800}
        className={cn("aspect-[4/5] w-full rounded-xl border bg-muted object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex aspect-video w-full flex-col md:aspect-[4/5] justify-between rounded-xl bg-primary p-6 text-white",
        className,
      )}
    >
      <span aria-hidden className="size-3 rounded-full bg-accent" />
      <div className="min-w-0 space-y-3">
        <p className="line-clamp-6 text-3xl leading-tight font-semibold tracking-tight text-balance break-words">
          {event.title}
        </p>
        <p className="text-sm font-medium break-words text-white/80">{event.clubName}</p>
      </div>
    </div>
  );
}
