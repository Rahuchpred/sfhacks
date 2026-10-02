"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_YEAR = "none";
// This year through six years out.
const THIS_YEAR = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 7 }, (_, index) => String(THIS_YEAR + index));

type Props = {
  id: string;
  // The year as text, or "" when not set.
  value: string;
  onChange: (value: string) => void;
  // A year saved earlier that is now outside the range stays selectable.
  keep?: string;
};

export function GradYearSelect({ id, value, onChange, keep }: Props) {
  const years = keep && !GRAD_YEARS.includes(keep) ? [keep, ...GRAD_YEARS] : GRAD_YEARS;

  return (
    <Select
      value={value || NO_YEAR}
      onValueChange={(next) => onChange(!next || next === NO_YEAR ? "" : next)}
    >
      <SelectTrigger id={id} className="w-full tabular-nums">
        <SelectValue>{value || <span className="text-muted-foreground">Not set</span>}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_YEAR}>Not set</SelectItem>
        {years.map((year) => (
          <SelectItem key={year} value={year} className="tabular-nums">
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
