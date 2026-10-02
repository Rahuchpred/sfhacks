// Notice dates are stored as plain days (YYYY-MM-DD). Reading them as local
// dates keeps the day from shifting across time zones.
export function formatNoticeDate(occurredOn: string | null): string {
  const match = occurredOn?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "Date not listed";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
