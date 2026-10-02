"use client";

// Mobbin reference: Zillow search map (web), a small floating key in a corner of the map.

import { useState } from "react";
import { ChevronDown, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampusEvent } from "@/lib/types";
import { CATEGORIES, OTHER_CATEGORY, mainCategory } from "./categories";

const dot = "flex size-5 shrink-0 items-center justify-center rounded-full";

function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center gap-2 text-xs">{children}</li>;
}

// Explains the pins. Lists only the categories that are on the map right now.
// Open by default on wide screens, closed on a phone where the map is small.
export function Legend({ events }: { events: CampusEvent[] }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const present = new Set(events.map((event) => mainCategory(event).tag));
  const categories = [...CATEGORIES, OTHER_CATEGORY].filter((category) =>
    present.has(category.tag),
  );

  return (
    <div
      className={cn(
        "absolute bottom-10 left-3 z-10 md:bottom-3 max-w-[calc(100%-5rem)] rounded-lg border bg-background/95 shadow-md backdrop-blur-sm",
        open === null ? "w-28 md:w-44" : open ? "w-44" : "w-28",
      )}
    >
      <button
        type="button"
        aria-expanded={open ?? undefined}
        onClick={() =>
          setOpen((current) => !(current ?? window.matchMedia("(min-width: 768px)").matches))
        }
        className="flex h-8 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-xs font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        Legend
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
            open === null ? "md:rotate-180" : open && "rotate-180",
          )}
        />
      </button>

      <ul
        className={cn(
          "space-y-1.5 px-2.5 pb-2.5",
          open === null ? "hidden md:block" : !open && "hidden",
        )}
      >
        <Row>
          <span className={cn(dot, "bg-accent text-accent-foreground")}>
            <Utensils aria-hidden className="size-3" />
          </span>
          Free food to claim
        </Row>
        {categories.map(({ tag, label, icon: Icon }) => (
          <Row key={tag}>
            <span className={cn(dot, "bg-primary text-primary-foreground")}>
              <Icon aria-hidden className="size-3" />
            </span>
            {label}
          </Row>
        ))}
        <Row>
          <span
            className={cn(dot, "w-auto min-w-5 bg-primary px-1.5 text-[0.65rem] font-semibold text-primary-foreground")}
          >
            3
          </span>
          Several events
        </Row>
        <Row>
          <span aria-hidden className={cn(dot, "relative bg-primary/25")}>
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-white bg-accent" />
          </span>
          Event with food
        </Row>
      </ul>
    </div>
  );
}
