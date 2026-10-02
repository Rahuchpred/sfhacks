"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EventFilters, TimeFilter } from "./use-event-filters";

const TIMES: { value: TimeFilter; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

type ChipProps = {
  pressed: boolean;
  onClick: () => void;
  tone?: "event" | "food";
  children: React.ReactNode;
};

function Chip({ pressed, onClick, tone = "event", children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        pressed
          ? tone === "food"
            ? "border-accent bg-accent text-accent-foreground"
            : "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
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
            onClick={() => filters.setTime(filters.time === value ? "all" : value)}
          >
            {label}
          </Chip>
        ))}
        <Chip
          tone="food"
          pressed={filters.foodOnly}
          onClick={() => filters.setFoodOnly(!filters.foodOnly)}
        >
          Free food
        </Chip>
        {filters.availableTags.map((tag) => (
          <Chip
            key={tag}
            pressed={filters.tags.includes(tag)}
            onClick={() => filters.toggleTag(tag)}
          >
            <span className="capitalize">{tag}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}
