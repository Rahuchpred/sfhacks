"use client";

// Reference: Square "New project" date and time popover (Mobbin, web):
// one calendar popover for the date, start and end time side by side.
import { useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fromMinutes, pacificParts, timeLabel, toMinutes } from "./form-utils";

const STEP = 15;
const SLOTS = Array.from({ length: (24 * 60) / STEP }, (_, index) => fromMinutes(index * STEP));

export type When = {
  date: string; // "YYYY-MM-DD" on campus, or ""
  start: string; // "HH:mm", or ""
  end: string;
  // Days the end falls after the start date. Only set by an event that runs past midnight.
  endDays: number;
};

// The calendar works in the browser's own zone, so a campus date is held at local noon.
function toCalendarDate(date: string): Date | undefined {
  if (!date) return undefined;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function fromCalendarDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dateLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round((minutes / 60) * 100) / 100} hr`;
}

// Picking a start keeps the event's length, or makes it one hour long.
export function withStart(when: When, start: string): When {
  const length =
    when.start && when.end && when.endDays === 0 && toMinutes(when.end) > toMinutes(when.start)
      ? toMinutes(when.end) - toMinutes(when.start)
      : 60;
  const end = Math.min(toMinutes(start) + length, 24 * 60 - STEP);
  return { ...when, start, end: end > toMinutes(start) ? fromMinutes(end) : "", endDays: 0 };
}

type WhenPickerProps = {
  value: When;
  onChange: (value: When) => void;
  // Marks the parts that are still empty.
  showMissing?: boolean;
  describedBy?: string;
};

export function WhenPicker({ value, onChange, showMissing, describedBy }: WhenPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = toCalendarDate(value.date);
  const today = toCalendarDate(pacificParts(new Date())?.date ?? "");

  // A time off the 15-minute grid (read from a flyer) still has to show.
  const withExtra = (slots: string[], extra: string) =>
    extra && !slots.includes(extra) ? [...slots, extra].sort() : slots;
  // The start list opens at 7 AM. The small hours come last.
  const morning = SLOTS.indexOf("07:00");
  const sorted = withExtra(SLOTS, value.start);
  const startSlots = [
    ...sorted.filter((slot) => slot >= SLOTS[morning]),
    ...sorted.filter((slot) => slot < SLOTS[morning]),
  ];
  const endSlots = withExtra(
    value.start && value.endDays === 0
      ? SLOTS.filter((slot) => toMinutes(slot) > toMinutes(value.start))
      : SLOTS,
    value.end,
  );
  const startItems = startSlots.map((slot) => ({ value: slot, label: timeLabel(slot) }));
  const endItems = endSlots.map((slot) => ({ value: slot, label: timeLabel(slot) }));

  const trigger =
    "h-9 min-w-0 flex-1 border-transparent bg-background tabular-nums hover:bg-background/60 dark:bg-background dark:hover:bg-background/60";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Date"
          aria-invalid={(showMissing && !value.date) || undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-lg border border-transparent bg-background px-2.5 text-sm transition-colors outline-none select-none hover:bg-background/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive sm:w-44",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {selected ? dateLabel.format(selected) : "Pick a date"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? today}
            disabled={today ? { before: today } : undefined}
            onSelect={(date) => {
              if (!date) return;
              onChange({ ...value, date: fromCalendarDate(date) });
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto sm:flex-1">
        <Select
          items={startItems}
          value={value.start || null}
          onValueChange={(start) => {
            if (start) onChange(withStart(value, start));
          }}
        >
          <SelectTrigger
            aria-label="Start time"
            aria-invalid={(showMissing && !value.start) || undefined}
            aria-describedby={describedBy}
            className={trigger}
          >
            <SelectValue placeholder="Start" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-72">
            {startItems.map((item) => (
              <SelectItem key={item.value} value={item.value} className="tabular-nums">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />

        <Select
          items={endItems}
          value={value.end || null}
          onValueChange={(end) => {
            if (end) onChange({ ...value, end, endDays: 0 });
          }}
        >
          <SelectTrigger
            aria-label="End time"
            aria-invalid={(showMissing && !value.end) || undefined}
            aria-describedby={describedBy}
            className={trigger}
          >
            <SelectValue placeholder="End" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-72 min-w-44">
            {endItems.map((item) => {
              const length =
                value.start && value.endDays === 0
                  ? toMinutes(item.value) - toMinutes(value.start)
                  : 0;
              return (
                <SelectItem key={item.value} value={item.value} className="tabular-nums">
                  {item.label}
                  {length > 0 && (
                    <span className="text-muted-foreground">{durationLabel(length)}</span>
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {value.endDays > 0 && (
        <span className="text-xs text-muted-foreground">
          Ends {value.endDays === 1 ? "the next day" : `${value.endDays} days later`}
        </span>
      )}
    </div>
  );
}
