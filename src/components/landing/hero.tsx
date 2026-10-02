"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { GrainGradient } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";
import type { CampusEvent } from "@/lib/types";
import { LiveCount } from "./live-count";

// Structure after tenseidesign.com: a full-screen hero with the text dead
// center and two buttons. The background is the Grain Gradient from Paper
// Shaders (paper.design), in SF State purple and gold.

const INK = "#1b1530";
const PURPLE = "#463077";
const LILAC = "#7a66ad";
const GOLD = "#c99700";

// Landing-only button shape: 48px tall, 4px corners, 28px side padding.
const buttonClass =
  "inline-flex h-12 items-center justify-center rounded-[4px] px-7 text-base font-medium transition-[background-color,border-color,scale] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring active:scale-[0.97] motion-reduce:transition-none";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type HeroProps = { events: CampusEvent[] };

export function Hero({ events }: HeroProps) {
  // With reduced motion the gradient is shown as a still image.
  const still = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#1b1530] px-5 py-24 text-center text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-75">
        <GrainGradient
          style={{ width: "100%", height: "100%" }}
          colorBack={INK}
          colors={[PURPLE, LILAC, GOLD]}
          softness={0.7}
          intensity={0.35}
          noise={0.3}
          shape="wave"
          speed={still ? 0 : 1}
        />
      </div>

      <p className="absolute top-6 left-5 flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-tight sm:left-8">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary">
          <span aria-hidden className="size-2 rounded-full bg-accent" />
        </span>
        Gator Radar
      </p>

      <div className="relative flex flex-col items-center">
        <LiveCount count={events.length} className="text-white/70" />
        <h1 className="mt-5 max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl">
          See what&apos;s on at SF State.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-pretty text-white/70 sm:text-xl">
          Every club event and free food drop, on one map.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/map"
            className={cn(buttonClass, "bg-accent text-accent-foreground hover:bg-[#dcaa14]")}
          >
            Open the map
          </Link>
          <Link
            href="/post"
            className={cn(
              buttonClass,
              "border border-white/25 bg-[#1b1530]/40 text-white hover:border-white/50 hover:bg-white/5",
            )}
          >
            Post an event
          </Link>
        </div>
      </div>
    </section>
  );
}
