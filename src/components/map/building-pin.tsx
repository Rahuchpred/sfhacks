import { Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

type PinProps = {
  label: string;
  selected: boolean;
  hovered: boolean;
  fresh: boolean;
  onHover: (hovering: boolean) => void;
};

const base =
  "relative flex items-center justify-center rounded-full border-2 border-white shadow-md transition-transform duration-150 focus-visible:ring-4 focus-visible:outline-none motion-reduce:transition-none";

// Pulsing ring behind a pin that just arrived live.
function FreshRing({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-0 rounded-full motion-safe:animate-ping", className)}
    />
  );
}

// Purple pin: one per building, showing how many events are there.
export function EventPin({
  count,
  hasFood,
  ...pin
}: PinProps & { count: number; hasFood: boolean }) {
  return (
    <span className="relative block">
      {pin.fresh && <FreshRing className="bg-primary/60" />}
      <button
        type="button"
        aria-label={pin.label}
        aria-pressed={pin.selected}
        onMouseEnter={() => pin.onHover(true)}
        onMouseLeave={() => pin.onHover(false)}
        onFocus={() => pin.onHover(true)}
        onBlur={() => pin.onHover(false)}
        className={cn(
          base,
          "size-8 cursor-pointer bg-primary text-sm font-semibold text-primary-foreground tabular-nums focus-visible:ring-primary/40",
          pin.hovered && "scale-115",
          pin.selected && "scale-125 ring-4 ring-primary/35",
        )}
      >
        {count}
        {hasFood && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-white bg-accent"
          />
        )}
      </button>
    </span>
  );
}

// Gold pin: leftover food that can be claimed right now.
export function FoodPin(pin: PinProps) {
  return (
    <span className="relative block">
      {pin.fresh && <FreshRing className="bg-accent/70" />}
      <button
        type="button"
        aria-label={pin.label}
        aria-pressed={pin.selected}
        onMouseEnter={() => pin.onHover(true)}
        onMouseLeave={() => pin.onHover(false)}
        onFocus={() => pin.onHover(true)}
        onBlur={() => pin.onHover(false)}
        className={cn(
          base,
          "size-8 cursor-pointer bg-accent text-accent-foreground focus-visible:ring-accent/50",
          pin.hovered && "scale-115",
          pin.selected && "scale-125 ring-4 ring-accent/45",
        )}
      >
        <Utensils aria-hidden className="size-4" />
      </button>
    </span>
  );
}
