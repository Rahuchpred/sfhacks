"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Building, CampusEvent, FoodRescue } from "@/lib/types";
import { LiveCount } from "./live-count";
import { RadarCanvas, type RadarPalette } from "./radar-canvas";

// Mobbin reference: Cursor's marketing home for the restraint (one headline,
// one line). Structure after tenseidesign.com: a full-screen hero with the
// text dead center, two buttons and quiet activity behind. The activity here
// is our own: a radar sweeping the real campus.

// Flip this one constant to make the hero light.
const HERO_THEME: "dark" | "light" = "dark";

type Theme = {
  section: string;
  muted: string;
  fade: string; // CSS color behind the headline, same as the background
  primary: string;
  secondary: string;
  radar: RadarPalette;
};

const THEMES: Record<"dark" | "light", Theme> = {
  dark: {
    section: "bg-[#1b1530] text-white",
    muted: "text-white/70",
    fade: "#1b1530",
    primary: "bg-accent text-accent-foreground hover:bg-[#dcaa14]",
    secondary: "border border-white/25 text-white hover:border-white/50 hover:bg-white/5",
    radar: { sweep: "#7a66ad", ring: "#ffffff", event: "#a08fd0", food: "#c99700" },
  },
  light: {
    section: "bg-background text-foreground",
    muted: "text-muted-foreground",
    fade: "#ffffff",
    primary: "bg-primary text-primary-foreground hover:bg-primary/85",
    secondary: "border border-border text-foreground hover:border-primary/40 hover:bg-muted",
    radar: { sweep: "#7a66ad", ring: "#463077", event: "#463077", food: "#c99700" },
  },
};

// Landing-only button shape: 48px tall, 4px corners, 28px side padding.
const buttonClass =
  "inline-flex h-12 items-center justify-center rounded-[4px] px-7 text-base font-medium transition-[background-color,border-color,scale] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring active:scale-[0.97] motion-reduce:transition-none";

type HeroProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
};

export function Hero({ buildings, events, rescues }: HeroProps) {
  const theme = THEMES[HERO_THEME];
  const eventBuildingIds = useMemo(
    () => new Set(events.map((event) => event.buildingId)),
    [events],
  );
  const foodBuildingIds = useMemo(
    () => new Set(rescues.map((rescue) => rescue.buildingId)),
    [rescues],
  );

  return (
    <section
      className={cn(
        "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-24 text-center",
        theme.section,
      )}
    >
      <RadarCanvas
        buildings={buildings}
        eventBuildingIds={eventBuildingIds}
        foodBuildingIds={foodBuildingIds}
        palette={theme.radar}
      />
      {/* A soft fade behind the text so it stays readable over the radar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 46% 40% at center, ${theme.fade} 0%, color-mix(in srgb, ${theme.fade} 72%, transparent) 55%, transparent 100%)`,
        }}
      />

      <p className="absolute top-6 left-5 flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-tight sm:left-8">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary">
          <span aria-hidden className="size-2 rounded-full bg-accent" />
        </span>
        Gator Radar
      </p>

      <div className="relative flex flex-col items-center">
        <LiveCount count={events.length} className={theme.muted} />
        <h1 className="mt-5 max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl">
          See what&apos;s on at SF State.
        </h1>
        <p className={cn("mt-6 max-w-xl text-lg text-pretty sm:text-xl", theme.muted)}>
          Every club event and free food drop, on one map.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/map" className={cn(buttonClass, theme.primary)}>
            Open the map
          </Link>
          <Link href="/post" className={cn(buttonClass, theme.secondary)}>
            Post an event
          </Link>
        </div>
      </div>
    </section>
  );
}
