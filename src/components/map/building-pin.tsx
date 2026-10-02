// Mobbin reference: GetYourGuide map view (web), pins that carry an icon and a name
// instead of a bare number, and Sweatpals explore map (web), icon pins beside a list.

import { Utensils, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PinProps = Omit<React.ComponentProps<"button">, "children"> & {
  label: string; // read by screen readers
  hint: string | null; // floats above the pin while it is hovered or selected
  selected: boolean;
  hovered: boolean;
  dimmed: boolean; // another pin is being pointed at from the list
  fresh: boolean;
  onHover: (hovering: boolean) => void;
};

const base =
  "relative flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1 rounded-full border-2 border-white shadow-md transition-[scale,opacity,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:ring-4 focus-visible:outline-none motion-reduce:transition-none";

// Pulsing ring behind a pin that just arrived live.
function FreshRing({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-0 rounded-full motion-safe:animate-ping", className)}
    />
  );
}

// The title above a pin. It never takes clicks, so the pin under it stays easy to hit.
function Hint({ text, tone }: { text: string | null; tone: "event" | "food" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-56 -translate-x-1/2 truncate rounded-md px-2 py-1 text-xs font-medium shadow-md transition-[opacity,translate] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
        tone === "food" ? "bg-accent text-accent-foreground" : "bg-foreground text-background",
        text ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
    >
      {text}
    </span>
  );
}

function PinShell({
  tone,
  hint,
  fresh,
  onHover,
  children,
}: Pick<PinProps, "hint" | "fresh" | "onHover"> & {
  tone: "event" | "food";
  children: React.ReactNode;
}) {
  return (
    <span
      className="relative block"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      {fresh && <FreshRing className={tone === "food" ? "bg-accent/70" : "bg-primary/60"} />}
      <Hint text={hint} tone={tone} />
      {children}
    </span>
  );
}

// Purple pin: the category icon of the event there. A building with several events shows
// their icons and the count.
export function EventPin({
  icons,
  count,
  hasFood,
  label,
  hint,
  selected,
  hovered,
  dimmed,
  fresh,
  onHover,
  className,
  ...button
}: PinProps & { icons: LucideIcon[]; count: number; hasFood: boolean }) {
  return (
    <PinShell tone="event" hint={hint} fresh={fresh} onHover={onHover}>
      <button
        type="button"
        aria-label={label}
        {...button}
        className={cn(
          base,
          "bg-primary text-sm font-semibold text-primary-foreground tabular-nums focus-visible:ring-primary/40",
          count > 1 && "px-2.5",
          dimmed && "opacity-45",
          hovered && "scale-125 ring-4 ring-primary/30",
          selected && "scale-125 ring-4 ring-primary/45",
          className,
        )}
      >
        {icons.map((Icon, index) => (
          <Icon key={index} aria-hidden className="size-4" />
        ))}
        {count > 1 && <span>{count}</span>}
        {hasFood && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-white bg-accent"
          />
        )}
      </button>
    </PinShell>
  );
}

// Gold pin: leftover food that can be claimed right now.
export function FoodPin({
  count,
  label,
  hint,
  selected,
  hovered,
  dimmed,
  fresh,
  onHover,
  className,
  ...button
}: PinProps & { count: number }) {
  return (
    <PinShell tone="food" hint={hint} fresh={fresh} onHover={onHover}>
      <button
        type="button"
        aria-label={label}
        {...button}
        className={cn(
          base,
          "bg-accent text-sm font-semibold text-accent-foreground tabular-nums focus-visible:ring-accent/50",
          count > 1 && "px-2.5",
          dimmed && "opacity-45",
          hovered && "scale-125 ring-4 ring-accent/40",
          selected && "scale-125 ring-4 ring-accent/60",
          className,
        )}
      >
        <Utensils aria-hidden className="size-4" />
        {count > 1 && <span>{count}</span>}
      </button>
    </PinShell>
  );
}
