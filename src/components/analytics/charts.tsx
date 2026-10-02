"use client";

import { useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { Count, EventStat } from "@/lib/analytics";

const PURPLE = "var(--primary)";
const GOLD = "var(--accent)";
// One ramp from the brand purple to gold, so slices stay in the SFSU palette.
const SLICES = ["#463077", "#7a66ad", "#c99700", "#2d1f52", "#e6c25c", "#a999cf", "#8a8496"];

const REDUCED = "(prefers-reduced-motion: reduce)";

// False when the visitor asked for reduced motion: the bars and slices then appear in place.
function useChartMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(REDUCED);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => !window.matchMedia(REDUCED).matches,
    () => true,
  );
}

// A lone bar stays a bar instead of filling the whole card.
const MAX_BAR = 72;

function shorten(text: string, max = 16): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const turnoutConfig = {
  registered: { label: "Registered", color: "#c9bfe3" },
  checkedIn: { label: "Checked in", color: PURPLE },
} satisfies ChartConfig;

export function TurnoutChart({ events }: { events: EventStat[] }) {
  const data = events.map((event) => ({
    name: shorten(event.title),
    registered: event.registered,
    checkedIn: event.checkedIn,
  }));
  const motion = useChartMotion();
  return (
    <ChartContainer config={turnoutConfig} className="h-64 w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="registered" fill="var(--color-registered)" radius={4} isAnimationActive={motion} />
        <Bar dataKey="checkedIn" fill="var(--color-checkedIn)" radius={4} isAnimationActive={motion} />
      </BarChart>
    </ChartContainer>
  );
}

export function DonutChart({ data, unit }: { data: Count[]; unit: string }) {
  const config = Object.fromEntries(
    data.map((item, index) => [item.label, { label: item.label, color: SLICES[index % SLICES.length] }]),
  ) satisfies ChartConfig;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const motion = useChartMotion();

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ChartContainer config={config} className="aspect-square h-44 shrink-0">
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius={48}
            strokeWidth={2}
            isAnimationActive={motion}
          >
            {data.map((item, index) => (
              <Cell key={item.label} fill={SLICES[index % SLICES.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {data.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: SLICES[index % SLICES.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {item.count} {item.count === 1 ? unit.replace(/s$/, "") : unit} · {total ? Math.round((item.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CountBars({
  data,
  label,
  color = PURPLE,
}: {
  data: Count[];
  label: string;
  color?: string;
}) {
  const config = { count: { label, color } } satisfies ChartConfig;
  const motion = useChartMotion();
  return (
    <ChartContainer config={config} className="h-52 w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={MAX_BAR} isAnimationActive={motion} />
      </BarChart>
    </ChartContainer>
  );
}

export function PercentBars({
  data,
}: {
  data: { label: string; events: number; turnoutPct: number | null }[];
}) {
  const config = { turnoutPct: { label: "Turnout %", color: GOLD } } satisfies ChartConfig;
  const motion = useChartMotion();
  return (
    <ChartContainer config={config} className="h-52 w-full">
      <BarChart data={data.map((item) => ({ ...item, turnoutPct: item.turnoutPct ?? 0 }))} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} unit="%" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="turnoutPct" fill="var(--color-turnoutPct)" radius={4} maxBarSize={MAX_BAR} isAnimationActive={motion} />
      </BarChart>
    </ChartContainer>
  );
}
