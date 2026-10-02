"use client";

// Mobbin reference: Canny's changelog page (small category label, date, short
// text), reused here for the card that opens above a marker.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapMarker, MarkerContent } from "@/components/ui/map";
import { ArrowRight, Shield } from "lucide-react";
import type { Building, SafetyNotice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatNoticeDate } from "./safety-utils";

type SafetyMarkersProps = {
  notices: SafetyNotice[];
  buildings: Building[];
};

type Group = { building: Building; notices: SafetyNotice[] };

// Only notices cleared for a pin, grouped so each building gets one marker.
function groupPinned(notices: SafetyNotice[], buildings: Building[]): Group[] {
  const groups = new Map<string, Group>();
  for (const notice of notices) {
    if (!notice.showPin || !notice.buildingId) continue;
    const building = buildings.find((item) => item.id === notice.buildingId);
    if (!building) continue;
    const group = groups.get(building.id) ?? { building, notices: [] };
    group.notices.push(notice);
    groups.set(building.id, group);
  }
  return [...groups.values()];
}

function SafetyPin({
  group,
  open,
  onOpenChange,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wrapper = useRef<HTMLSpanElement>(null);
  // Whether the card was open before the current press, so a press that also
  // focuses the pin does not open and then close it.
  const openBeforePress = useRef<boolean | null>(null);
  const cardId = useId();
  const count = group.notices.length;
  const label = `${group.building.name}, ${count === 1 ? "1 safety notice" : `${count} safety notices`} from University Police`;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) onOpenChange(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <span
      ref={wrapper}
      className="relative block"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onPointerDown={() => {
          openBeforePress.current = open;
        }}
        onFocus={() => onOpenChange(true)}
        onClick={() => {
          onOpenChange(!(openBeforePress.current ?? open));
          openBeforePress.current = null;
        }}
        className={cn(
          "relative flex size-7 cursor-pointer items-center justify-center rounded-md border-2 border-white bg-slate-700 text-white shadow-md transition-transform duration-150 hover:scale-115 focus-visible:ring-4 focus-visible:ring-slate-500/40 focus-visible:outline-none motion-reduce:transition-none",
          // Larger touch target without a larger marker.
          "after:absolute after:-inset-2",
          open && "scale-115 ring-4 ring-slate-500/35",
        )}
      >
        <Shield aria-hidden="true" className="size-3.5" />
      </button>

      {open && (
        <div
          id={cardId}
          role="group"
          aria-label={`Safety notices at ${group.building.name}`}
          className="absolute bottom-full left-1/2 mb-2.5 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 cursor-auto rounded-xl bg-popover p-3 text-left text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-safe:zoom-in-95"
        >
          <ul className="max-h-56 space-y-3 overflow-y-auto">
            {group.notices.map((notice) => (
              <li key={notice.id} className="space-y-1">
                <p className="font-medium">{notice.category}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatNoticeDate(notice.occurredOn)}, University Police
                </p>
                <p className="text-pretty break-words">{notice.summary}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/safety"
            className="mt-3 inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            All safety notices
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      )}
    </span>
  );
}

// Slate shield markers for official notices. Place inside the campus <Map>.
// Notices with showPin false, or without a known building, are never drawn.
export function SafetyMarkers({ notices, buildings }: SafetyMarkersProps) {
  const groups = useMemo(() => groupPinned(notices, buildings), [notices, buildings]);
  const [openId, setOpenId] = useState<string | null>(null);

  return groups.map((group) => {
    const { building } = group;
    const open = openId === building.id;
    return (
      <MapMarker
        key={building.id}
        longitude={building.lng}
        latitude={building.lat}
        anchor="center"
        // Sits above the event and food pins, which share the building's center.
        offset={[0, -32]}
        zIndex={open ? 4 : 1}
      >
        <MarkerContent>
        <SafetyPin
          group={group}
          open={open}
          onOpenChange={(next) =>
            setOpenId((current) => (next ? building.id : current === building.id ? null : current))
          }
        />
      </MarkerContent>
      </MapMarker>
    );
  });
}
