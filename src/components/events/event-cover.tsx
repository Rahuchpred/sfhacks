import { mainCategory } from "@/components/map/categories";
import { cn } from "@/lib/utils";
import type { CampusEvent } from "@/lib/types";

type EventCoverProps = {
  event: Pick<CampusEvent, "title" | "clubName" | "flyerUrl" | "tags">;
  className?: string;
};

// The flyer, or a generated cover in the category colour when the event has none. It is
// the large version of the tile that leads the event in every list.
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
        className={cn("aspect-square w-full rounded-xl border bg-muted object-cover", className)}
      />
    );
  }

  const category = mainCategory(event);
  const Icon = category.icon;

  return (
    <div
      className={cn(
        "relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-xl p-6 md:aspect-square",
        category.tint,
        className,
      )}
    >
      <Icon aria-hidden className="absolute -right-8 -bottom-10 size-56 opacity-10" />
      <span className="relative flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="relative min-w-0 space-y-3">
        <p className="line-clamp-6 text-3xl leading-tight font-semibold tracking-tight text-balance break-words">
          {event.title}
        </p>
        <p className="text-sm font-medium break-words opacity-80">{event.clubName}</p>
      </div>
    </div>
  );
}
