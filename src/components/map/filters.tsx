"use client";

// Mobbin reference: Zillow search map (web), a row of filter dropdowns above the results,
// and GetYourGuide map view (web), filter chips above a list that sits beside the map.

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { TIME_LABELS, type EventFilters, type TimeFilter } from "./use-event-filters";

const TIMES: Exclude<TimeFilter, "all">[] = ["now", "soon", "today", "week"];
const ALL = "all";

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
        "shrink-0 rounded-full border-border bg-background px-3 active:scale-[0.97] motion-reduce:active:scale-100",
        tone === "food"
          ? "aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:hover:bg-accent/85 aria-pressed:hover:text-accent-foreground"
          : "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/85 aria-pressed:hover:text-primary-foreground",
      )}
    >
      {children}
    </Toggle>
  );
}

type PickerProps = {
  label: string;
  allLabel: string;
  value: string | null;
  options: { id: string; name: string }[];
  onChange: (id: string | null) => void;
};

function Picker({ label, allLabel, value, options, onChange }: PickerProps) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(!next || next === ALL ? null : next)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("h-9 w-full min-w-0 flex-1", value && "border-primary text-primary")}
      >
        <SelectValue>
          <span className="truncate">
            {options.find((option) => option.id === value)?.name ?? allLabel}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="min-w-56">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Filters({ filters }: { filters: EventFilters }) {
  return (
    <div className="space-y-2 border-b py-2.5 md:space-y-2.5 md:py-3">
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

      <div
        role="group"
        aria-label="Filters"
        className="flex gap-1.5 overflow-x-auto px-5 py-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible"
      >
        {TIMES.map((value) => (
          <Chip
            key={value}
            pressed={filters.time === value}
            onPressedChange={(pressed) => filters.setTime(pressed ? value : "all")}
          >
            {TIME_LABELS[value]}
          </Chip>
        ))}
        <Chip tone="food" pressed={filters.foodOnly} onPressedChange={filters.setFoodOnly}>
          Free food
        </Chip>
        {filters.canFilterMine && (
          <Chip pressed={filters.mineOnly} onPressedChange={filters.setMineOnly}>
            Registered
          </Chip>
        )}
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

      <div className="flex gap-2 px-5">
        {filters.availableClubs.length > 0 && (
          <Picker
            label="Club"
            allLabel="All clubs"
            value={filters.clubId}
            options={filters.availableClubs}
            onChange={filters.setClubId}
          />
        )}
        <Picker
          label="Building"
          allLabel="All buildings"
          value={filters.buildingId}
          options={filters.availableBuildings}
          onChange={filters.setBuildingId}
        />
      </div>

      {filters.active && (
        <div className="flex items-start gap-2 px-5">
          <ul
            aria-label="Active filters"
            className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible"
          >
            {filters.chips.map((chip) => (
              <li key={chip.key} className="shrink-0 md:max-w-full md:shrink">
                <button
                  type="button"
                  aria-label={`Remove filter: ${chip.label}`}
                  onClick={chip.remove}
                  className={cn(
                    "flex h-7 max-w-56 items-center gap-1 rounded-full pr-1.5 pl-2.5 text-xs font-medium transition-[background-color,scale] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                    chip.tone === "food"
                      ? "bg-accent/25 text-accent-foreground hover:bg-accent/40"
                      : "bg-secondary text-secondary-foreground hover:bg-primary/15",
                  )}
                >
                  <span className="truncate">{chip.label}</span>
                  <X aria-hidden className="size-3.5 shrink-0 opacity-70" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={filters.clear}
            className="h-8 shrink-0 rounded-md px-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
