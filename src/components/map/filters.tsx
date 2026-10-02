"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import type { EventFilters, TimeFilter } from "./use-event-filters";

const TIMES: { value: TimeFilter; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

type ChipProps = {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  tone?: "event" | "food";
  children: React.ReactNode;
};

// Purple when pressed for event filters, gold for food.
function Chip({ pressed, onPressedChange, tone = "event", children }: ChipProps) {
  return (
    <Toggle
      variant="outline"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className={cn(
        "shrink-0 rounded-full border-border bg-background px-3",
        tone === "food"
          ? "aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:hover:bg-accent/85 aria-pressed:hover:text-accent-foreground"
          : "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/85 aria-pressed:hover:text-primary-foreground",
      )}
    >
      {children}
    </Toggle>
  );
}

export function Filters({ filters }: { filters: EventFilters }) {
  return (
    <div className="space-y-2.5 border-b py-2.5 md:space-y-3 md:py-3">
      <div className="relative mx-5">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          name="search"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search events by title, club or building"
          placeholder="Search title, club or building…"
          value={filters.query}
          onChange={(event) => filters.setQuery(event.target.value)}
          className="h-9 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => filters.setQuery("")}
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Filters" className="flex gap-1.5 overflow-x-auto px-5 py-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible"
      >
        {TIMES.map(({ value, label }) => (
          <Chip
            key={value}
            pressed={filters.time === value}
            onPressedChange={(pressed) => filters.setTime(pressed ? value : "all")}
          >
            {label}
          </Chip>
        ))}
        <Chip
          tone="food"
          pressed={filters.foodOnly}
          onPressedChange={filters.setFoodOnly}
        >
          Free food
        </Chip>
        {filters.availableTags.map((tag) => (
          <Chip
            key={tag}
            pressed={filters.tags.includes(tag)}
            onPressedChange={() => filters.toggleTag(tag)}
          >
            <span className="capitalize">{tag}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}
