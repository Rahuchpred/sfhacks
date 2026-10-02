// Labels for planner times and numbers, always in campus time.
import { TIMEZONE } from "@/lib/checks";
import type { Clash, Forecast } from "@/lib/planner-types";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

// "Thu, Oct 8"
export function dayLabel(instant: string): string {
  return dayFormat.format(new Date(instant));
}

// "5:00 PM"
export function clockLabel(instant: string): string {
  return timeFormat.format(new Date(instant));
}

// "5:00 to 7:00 PM", or "11:30 AM to 1:00 PM" across noon.
export function rangeLabel(startsAt: string, endsAt: string): string {
  const start = clockLabel(startsAt);
  const end = clockLabel(endsAt);
  const sameHalf = start.slice(-2) === end.slice(-2);
  return `${sameHalf ? start.slice(0, -3) : start} to ${end}`;
}

// "30 to 48", or "38" when the range is a single number.
export function peopleRange(forecast: Forecast): string {
  return forecast.low === forecast.high ? String(forecast.high) : `${forecast.low} to ${forecast.high}`;
}

// "24% of your crowd", or null when the share is unknown.
export function shareLabel(clash: Clash): string | null {
  if (clash.audienceShare === null) return null;
  return `${Math.round(clash.audienceShare * 100)}% of your crowd`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} hr`;
}
