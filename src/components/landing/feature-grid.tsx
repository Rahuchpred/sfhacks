"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Utensils } from "lucide-react";
import { RescueCard } from "@/components/food/rescue-card";
import { useNow } from "@/components/map/use-event-filters";
import { AttendanceList } from "@/components/profile/attendance-list";
import { attendanceStats } from "@/components/profile/profile-utils";
import { StatsRow } from "@/components/profile/stats-row";
import { TicketQr } from "@/components/tickets/ticket-qr";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Building, CampusEvent, FoodRescue, TicketWithEvent } from "@/lib/types";

// Mobbin references: Assembly's resources bento (one large dark card beside
// smaller ones) and Luma AI's feature cards (title and one line at the top,
// the product piece below, cropped by the card). The section keeps the hero's
// ink background so the page reads as one piece. Every visual is the real
// component with live data, shown read-only on a light "window" inside the
// dark card: the window is inert and the whole card is one link.

const EmbeddedMap = dynamic(() => import("./embedded-map"), {
  ssr: false,
  // A dark pulse: the default light skeleton flashed white before the dark map.
  loading: () => (
    <Skeleton className="size-full rounded-none bg-white/[0.06] motion-reduce:animate-none" />
  ),
});

type FeatureGridProps = {
  buildings: Building[];
  events: CampusEvent[];
  rescues: FoodRescue[];
  loading: boolean;
  error: string | null;
};

export function FeatureGrid({ buildings, events, rescues, loading, error }: FeatureGridProps) {
  return (
    <section aria-labelledby="features-title" className="bg-[#1b1530] text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <h2
          id="features-title"
          className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl"
        >
          One place for campus life.
        </h2>

        <ul className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-3">
          <FeatureCard
            href="/map"
            title="Live campus map"
            line="Every event, pinned to its building."
            className="md:col-span-2"
            bleed
          >
            <MapPanel buildings={buildings} events={events} rescues={rescues} />
          </FeatureCard>

          <FeatureCard
            href="/food"
            title="Free leftover food"
            line="Claim a portion, pick it up with a code."
          >
            <FoodPanel
              buildings={buildings}
              events={events}
              rescues={rescues}
              loading={loading}
              error={error}
            />
          </FeatureCard>

          <FeatureCard
            href="/tickets"
            title="QR check-in"
            line="Your ticket scans at the door."
            label="Sample ticket"
          >
            <div className="flex h-full items-center justify-center pb-4">
              <TicketQr code="GATOR123" size={132} />
            </div>
          </FeatureCard>

          <FeatureCard
            href="/profile"
            title="A profile that builds itself"
            line="Each check-in adds to it."
            label="Sample"
            className="md:col-span-2"
          >
            <ProfilePanel events={events} />
          </FeatureCard>
        </ul>
      </div>
    </section>
  );
}

function FeatureCard({
  href,
  title,
  line,
  label,
  bleed = false,
  className,
  children,
}: {
  href: string;
  title: string;
  line: string;
  label?: string; // marks a window that shows sample data
  bleed?: boolean; // the window runs to the card's edges (the map)
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "group relative flex h-[26rem] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition-[border-color,background-color,scale] duration-200 ease-out focus-within:ring-3 focus-within:ring-white/40 hover:border-white/25 hover:bg-white/[0.06] active:scale-[0.995] motion-reduce:transition-none",
        className,
      )}
    >
      <div className="px-6 pt-6 pb-5">
        <h3 className="text-lg font-medium tracking-tight">
          {/* The link stretches over the whole card. */}
          <Link href={href} className="outline-none after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        <p className="mt-1 text-[0.9375rem] text-white/60">{line}</p>
      </div>

      {/* The light window. It lifts a little when the card is hovered. */}
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden text-foreground transition-transform duration-200 ease-out group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0",
          // The map is dark, so its window stays dark while the tiles load.
          bleed ? "border-t border-white/10 bg-[#16161a]" : "mx-6 rounded-t-lg bg-[#f8f7fb]",
        )}
      >
        {/* Read-only: nothing inside takes focus, clicks or scroll. */}
        <div inert className="pointer-events-none size-full select-none">
          {children}
        </div>
        {label && (
          <Badge variant="outline" className="absolute top-3 left-3 bg-background">
            {label}
          </Badge>
        )}
      </div>
      {/* Softens the cut where the card crops the window. */}
      {!bleed && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#1b1530]/55 to-transparent"
        />
      )}
    </li>
  );
}

// The real map, mounted only once the card is close to the screen so the hero
// paints first.
function MapPanel({
  buildings,
  events,
  rescues,
}: Pick<FeatureGridProps, "buildings" | "events" | "rescues">) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="size-full">
      {near && <EmbeddedMap buildings={buildings} events={events} rescues={rescues} />}
    </div>
  );
}

// One real open rescue in the real card, or the food page's empty state.
function FoodPanel({ buildings, events, rescues, loading, error }: FeatureGridProps) {
  const now = useNow();
  const rescue = rescues[0];

  if (loading) {
    return (
      <div className="mx-auto w-64 pt-5">
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }
  if (error || !rescue) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent/15">
          <Utensils aria-hidden className="size-6" />
        </div>
        <p className="text-base font-medium">No free food right now</p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-64 pt-5 text-sm">
      <RescueCard
        rescue={rescue}
        building={buildings.find((building) => building.id === rescue.buildingId)}
        event={events.find((event) => event.id === rescue.eventId)}
        now={now}
        holds={NO_HOLDS}
        takenCount={0}
        onClaim={noClaim}
      />
    </div>
  );
}

const NO_HOLDS: never[] = [];
const noClaim = async () => ({ ok: false, message: null, closed: false });

// The real profile stats and attendance list, fed a sample: the next few real
// events, as if this student had been checked in to them.
function ProfilePanel({ events }: { events: CampusEvent[] }) {
  const sample = useMemo<TicketWithEvent[]>(
    () =>
      events.slice(0, 3).map((event) => ({
        id: `sample-${event.id}`,
        eventId: event.id,
        code: "GATOR123",
        createdAt: event.startsAt,
        checkedInAt: event.startsAt,
        event,
      })),
    [events],
  );

  return (
    <div className="space-y-3 px-3 pt-12 sm:px-5">
      <StatsRow stats={attendanceStats(sample)} />
      <AttendanceList attended={sample} />
    </div>
  );
}
