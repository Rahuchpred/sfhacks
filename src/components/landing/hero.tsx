"use client";

import Link from "next/link";
import Aurora from "@/components/reactbits/Aurora";
import LightRays from "@/components/reactbits/LightRays";
import Particles from "@/components/reactbits/Particles";
import Threads from "@/components/reactbits/Threads";
import { cn } from "@/lib/utils";
import type { CampusEvent } from "@/lib/types";
import { LiveCount } from "./live-count";

// Structure after tenseidesign.com: a full-screen hero with the text dead
// center, two buttons and quiet activity behind. The activity is a ready-made
// background from React Bits (reactbits.dev, MIT + Commons Clause), recolored
// to SF State purple and gold. Change BACKGROUND to try another one.
const BACKGROUND: "aurora" | "threads" | "rays" | "particles" = "aurora";

const PURPLE = "#463077";
const LILAC = "#7a66ad";
const GOLD = "#c99700";

function HeroBackground() {
  switch (BACKGROUND) {
    case "aurora":
      return <Aurora colorStops={[PURPLE, GOLD, LILAC]} amplitude={1.1} blend={0.6} speed={0.6} />;
    case "threads":
      return <Threads color={[0.63, 0.56, 0.82]} amplitude={1.2} distance={0.2} enableMouseInteraction />;
    case "rays":
      return (
        <LightRays
          raysOrigin="top-center"
          raysColor={LILAC}
          raysSpeed={0.8}
          lightSpread={1.1}
          rayLength={1.6}
          followMouse
          mouseInfluence={0.08}
        />
      );
    case "particles":
      return (
        <Particles
          particleColors={["#ffffff", LILAC, GOLD]}
          particleCount={260}
          particleSpread={10}
          speed={0.08}
          particleBaseSize={90}
          alphaParticles
          moveParticlesOnHover
        />
      );
  }
}

const theme = {
  section: "bg-[#1b1530] text-white",
  muted: "text-white/70",
  fade: "#1b1530",
  primary: "bg-accent text-accent-foreground hover:bg-[#dcaa14]",
  secondary: "border border-white/25 text-white hover:border-white/50 hover:bg-white/5",
};

// Landing-only button shape: 48px tall, 4px corners, 28px side padding.
const buttonClass =
  "inline-flex h-12 items-center justify-center rounded-[4px] px-7 text-base font-medium transition-[background-color,border-color,scale] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring active:scale-[0.97] motion-reduce:transition-none";

type HeroProps = { events: CampusEvent[] };

export function Hero({ events }: HeroProps) {
  return (
    <section
      className={cn(
        "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-24 text-center",
        theme.section,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80 motion-reduce:hidden">
        <HeroBackground />
      </div>
      {/* A soft fade behind the text so it stays readable over the background. */}
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
