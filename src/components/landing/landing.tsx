"use client";

import Link from "next/link";
import { ArrowRight, Utensils } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCampus } from "@/lib/use-campus";
import { EventStrip } from "./event-strip";
import { HowItWorks } from "./how-it-works";
import { LiveNumbers } from "./live-numbers";
import { RadarRings } from "./radar-rings";

export function Landing() {
  const { buildings, events, rescues, loading, error } = useCampus();
  const showFoodBand = !loading && !error && rescues.length > 0;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <section className="relative overflow-hidden">
        <RadarRings className="absolute top-1/2 -right-40 hidden w-[36rem] -translate-y-1/2 md:block lg:-right-16" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-20 lg:pt-28 lg:pb-24">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <span aria-hidden className="size-2 rounded-full bg-accent" />
            Gator Radar, for SF State
          </p>
          <h1 className="mt-5 text-5xl leading-[0.95] font-semibold tracking-tighter text-balance lowercase sm:text-6xl lg:text-7xl">
            <span className="block">see what&apos;s on.</span>
            <span className="block">show up.</span>
            <span className="block text-primary">get noticed.</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-pretty text-muted-foreground sm:text-lg">
            Every club event and free food drop at SF State, on one map. Each check-in builds
            your profile.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/map"
              className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 px-6 text-base")}
            >
              Open the map
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/post"
              className="rounded-sm text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Posting for a club?
            </Link>
          </div>
          <div className="mt-12 min-h-[4.25rem]">
            <LiveNumbers
              eventCount={events.length}
              rescueCount={rescues.length}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </section>

      {showFoodBand && (
        <Link
          href="/food"
          className="group block bg-accent text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
        >
          <span className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-5 py-3.5 text-sm font-semibold sm:px-8 sm:text-base">
            <Utensils aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 tabular-nums">
              Free food right now: {rescues.length} {rescues.length === 1 ? "post" : "posts"}
            </span>
            <ArrowRight
              aria-hidden
              className="ml-auto size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </span>
        </Link>
      )}

      <HowItWorks />

      <EventStrip buildings={buildings} events={events} loading={loading} error={error} />

      <footer className="mt-auto border-t">
        <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 py-6 text-sm text-muted-foreground sm:px-8">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          Built at SF Hacks 2026 for SF State.
        </p>
      </footer>
    </div>
  );
}
