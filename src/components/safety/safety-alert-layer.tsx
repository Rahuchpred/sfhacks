"use client";

// Mobbin was not reachable in this session. Reference from memory: Citizen's incident map
// (a translucent red radius with a small time label at its center, details in a card).

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useMapLook } from "@/components/map/map-look";
import { MapGeoJSON, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { alertCategoryLabel, type SafetyAlert } from "@/lib/db-safety";
import { cn } from "@/lib/utils";
import { ALERT_RED, ALERT_RED_ON_DARK, alertsToGeoJSON, alertTime, pointAt } from "./alert-utils";
import { useSafetyAlerts } from "./use-safety-alerts";

// Room the card needs above its label, in pixels.
const CARD_ROOM = 250;

function AlertLabel({
  alert,
  now,
  open,
  onOpenChange,
}: {
  alert: SafetyAlert;
  now: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wrapper = useRef<HTMLSpanElement>(null);
  const cardId = useId();
  const happened = alertTime(alert.occurredAt, now);

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
    <span ref={wrapper} className="relative block">
      <button
        type="button"
        aria-label={`Campus safety alert: ${alert.title}, happened at ${happened}`}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onClick={() => onOpenChange(!open)}
        className={cn(
          // White edge and shadow keep the label readable on every map type.
          "relative flex h-7 cursor-pointer items-center gap-1 rounded-full border-2 border-white bg-red-600 pr-2.5 pl-2 text-xs font-semibold whitespace-nowrap text-white tabular-nums shadow-md transition-transform duration-150 ease-out hover:scale-105 focus-visible:ring-4 focus-visible:ring-red-600/40 focus-visible:outline-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          "after:absolute after:-inset-2",
          open && "ring-4 ring-red-600/30",
        )}
      >
        <TriangleAlert aria-hidden="true" className="size-3.5" />
        {happened}
      </button>

      {open && (
        <div
          id={cardId}
          role="group"
          aria-label={`Campus safety alert: ${alert.title}`}
          className="absolute bottom-full left-1/2 mb-2.5 w-64 max-w-[calc(100vw-2rem)] origin-bottom -translate-x-1/2 cursor-auto rounded-xl bg-popover p-3 text-left text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-safe:zoom-in-95"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-red-600" />
            {alertCategoryLabel(alert.category)}
          </p>
          <p className="mt-1 font-medium text-pretty break-words">{alert.title}</p>
          {alert.details && (
            <p className="mt-1 text-pretty break-words text-muted-foreground">{alert.details}</p>
          )}
          <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t pt-2.5 text-xs tabular-nums">
            <dt className="text-muted-foreground">Happened at</dt>
            <dd>
              <time dateTime={alert.occurredAt}>{happened}</time>
            </dd>
            <dt className="text-muted-foreground">Shown until</dt>
            <dd>
              <time dateTime={alert.expiresAt}>{alertTime(alert.expiresAt, now)}</time>
            </dd>
          </dl>
          <p className="mt-2.5 text-xs text-muted-foreground tabular-nums">
            Posted by Campus safety at {alertTime(alert.createdAt, now)}
          </p>
        </div>
      )}
    </span>
  );
}

// Every active alert as a red circle at its true size, with the time it happened at the
// center. Place inside a <Map>. It loads and keeps its own data, so it needs no props.
// `dark` says the map under it is the dark one. Left out, it follows the visitor's map type.
export function SafetyAlertLayer({ dark }: { dark?: boolean }) {
  const { map } = useMap();
  const { alerts, now } = useSafetyAlerts();
  const [look] = useMapLook();
  const onDark = dark ?? look.id === "dark";
  // "Show on map" links arrive as /map?alert=<id>, and that alert starts open.
  const [linkedId] = useState(() => new URLSearchParams(window.location.search).get("alert"));
  const [openId, setOpenId] = useState<string | null>(linkedId);

  const data = useMemo(() => alertsToGeoJSON(alerts), [alerts]);
  const fillPaint = useMemo(
    () => ({
      "fill-color": onDark ? ALERT_RED_ON_DARK : ALERT_RED,
      "fill-opacity": onDark ? 0.24 : 0.16,
    }),
    [onDark],
  );
  const linePaint = useMemo(
    () => ({
      "line-color": onDark ? ALERT_RED_ON_DARK : ALERT_RED,
      "line-width": 2,
      "line-opacity": 0.9,
    }),
    [onDark],
  );

  // Moves the map when the card would not fit above the label. With `focus` it fits the circle.
  function reveal(alert: SafetyAlert, focus = false) {
    if (!map) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const center: [number, number] = [alert.lng, alert.lat];
    const y = map.project(center).y;
    const height = map.getContainer().clientHeight;
    if (focus) {
      // The whole circle in view, with room above for the card.
      const north = pointAt(alert.lat, alert.lng, alert.radiusM, 0);
      const south = pointAt(alert.lat, alert.lng, alert.radiusM, 180);
      const east = pointAt(alert.lat, alert.lng, alert.radiusM, 90);
      const west = pointAt(alert.lat, alert.lng, alert.radiusM, 270);
      const side = Math.min(40, height / 10);
      map.fitBounds(
        [
          [west[0], south[1]],
          [east[0], north[1]],
        ],
        {
          padding: { top: Math.min(CARD_ROOM, height * 0.4), bottom: side, left: side, right: side },
          maxZoom: 17,
          bearing: map.getBearing(),
          duration: still ? 0 : 700,
        },
      );
      return;
    }
    if (y >= CARD_ROOM && y <= height) return;
    map.easeTo({
      center,
      // Lower than the middle, so the card above the label has room.
      offset: [0, Math.min(CARD_ROOM / 2, height / 4)],
      duration: still ? 0 : 500,
    });
  }

  function show(alert: SafetyAlert) {
    setOpenId(alert.id);
    reveal(alert);
  }

  // Bring the linked alert into view, once, when it has loaded.
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current || !map || !linkedId || alerts.length === 0) return;
    linked.current = true;
    const alert = alerts.find((item) => item.id === linkedId);
    if (alert) reveal(alert, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, alerts, linkedId]);

  const shown = openId && alerts.some((alert) => alert.id === openId) ? openId : null;

  return (
    <>
      <MapGeoJSON
        id="safety-alerts"
        data={data}
        fillPaint={fillPaint}
        linePaint={linePaint}
        interactive
        onClick={(event) => {
          const id = event.feature.properties?.id;
          const alert = alerts.find((item) => item.id === id);
          if (alert) show(alert);
        }}
      />
      {alerts.map((alert) => (
        <MapMarker
          key={alert.id}
          longitude={alert.lng}
          latitude={alert.lat}
          anchor="center"
          // Above the event, food and notice pins.
          zIndex={shown === alert.id ? 6 : 5}
        >
          <MarkerContent>
            <AlertLabel
              alert={alert}
              now={now}
              open={shown === alert.id}
              onOpenChange={(next) => {
                if (next) show(alert);
                else setOpenId((current) => (current === alert.id ? null : current));
              }}
            />
          </MarkerContent>
        </MapMarker>
      ))}
    </>
  );
}
