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

// Mobbin reference: Perplexity's welcome cards (a piece of real UI on a tinted
// panel, then a title and one line). Layout follows the feature grid on
// obsidian.md. Every visual is the real component with live data, shown
// read-only: the panel is inert and the whole card is one link.

const EmbeddedMap = dynamic(() => import("./embedded-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
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
    <section
      aria-label="Features"
      className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28"
    >
      <ul className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          href="/map"
          title="Live campus map"
          line="Every event, pinned to its building."
          className="md:col-span-3"
          panelClass="h-72 sm:h-[26rem]"
        >
          <MapPanel buildings={buildings} events={events} rescues={rescues} />
        </FeatureCard>

        <FeatureCard
          href="/food"
          title="Free leftover food"
          line="Claim a portion, pick it up with a code."
          fade
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
          <div className="flex h-full items-center justify-center">
            <TicketQr code="GATOR123" size={132} />
          </div>
        </FeatureCard>

        <FeatureCard
          href="/profile"
          title="A profile that builds itself"
          line="Each check-in adds to it."
          label="Sample"
          fade
        >
          <ProfilePanel events={events} />
        </FeatureCard>
      </ul>
    </section>
  );
}

function FeatureCard({
  href,
  title,
  line,
  label,
  fade = false,
  className,
  panelClass = "h-80",
  children,
}: {
  href: string;
  title: string;
  line: string;
  label?: string; // marks a panel that shows sample data
  fade?: boolean; // the panel crops a taller piece of UI, so soften the cut
  className?: string;
  panelClass?: string;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card transition-[border-color,scale] duration-150 ease-out focus-within:ring-3 focus-within:ring-ring/50 hover:border-primary/40 active:scale-[0.995] motion-reduce:transition-none",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden border-b bg-muted/60", panelClass)}>
        {/* Read-only: nothing inside takes focus, clicks or scroll. */}
        <div inert className="pointer-events-none size-full select-none">
          {children}
        </div>
        {fade && (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#f8f7fb] to-transparent"
          />
        )}
        {label && (
          <Badge variant="outline" className="absolute top-3 left-3 bg-background">
            {label}
          </Badge>
        )}
      </div>
      <div className="px-5 py-4">
        <h2 className="text-[0.9375rem] font-medium">
          {/* The link stretches over the whole card. */}
          <Link href={href} className="outline-none after:absolute after:inset-0">
            {title}
          </Link>
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{line}</p>
      </div>
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
      <div className="mx-auto w-64 pt-6">
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
    <div className="mx-auto w-64 pt-6 text-sm">
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
    <div className="min-w-[21rem] space-y-3 px-4 pt-12">
      <StatsRow stats={attendanceStats(sample)} />
      <AttendanceList attended={sample} />
    </div>
  );
}
