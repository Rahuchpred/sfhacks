import { cn } from "@/lib/utils";
import type { Club } from "@/lib/types";
import { clubInitials, clubTone } from "./club-utils";

// Initials on an SF State color. Decorative: the club name always sits next to it.
export function ClubAvatar({ club, size = "md" }: { club: Club; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold tracking-tight select-none",
        size === "lg" ? "size-16 rounded-2xl text-xl" : "size-11 rounded-xl text-sm",
        clubTone(club.id),
      )}
    >
      {clubInitials(club.name)}
    </span>
  );
}

// Marks a club or event that is on right now.
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2 text-xs font-medium text-primary",
        className,
      )}
    >
      <span aria-hidden className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
      </span>
      Now
    </span>
  );
}
