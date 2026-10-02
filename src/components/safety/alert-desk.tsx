"use client";

// Mobbin was not reachable in this session. Reference from memory: Uber's "set pickup"
// screen (a map you click to place a pin, a short form beside it, one main button).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, LoaderCircle, MousePointerClick, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { lookById } from "@/components/map/map-look";
import { Field } from "@/components/post/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import {
  ALERT_CATEGORIES,
  ALERT_DURATIONS,
  ALERT_RADIUS,
  alertCategoryLabel,
  clearAlert,
  inAlertBounds,
  listEndedAlerts,
  postAlert,
  subscribeToAlerts,
  type AlertCategory,
  type AlertDuration,
  type SafetyAlert,
} from "@/lib/db-safety";
import { cn } from "@/lib/utils";
import {
  ALERT_RED,
  alertTime,
  circlePolygon,
  distanceMeters,
  namesAnAddress,
  pointAt,
} from "./alert-utils";
import { SafetyAlertLayer } from "./safety-alert-layer";
import { useSafetyAlerts } from "./use-safety-alerts";

const SFSU_CENTER: [number, number] = [-122.4793, 37.7229];
const LIGHT = lookById("light").url;
const STYLES = { light: LIGHT, dark: LIGHT };
const SIZES = [50, 100, 200, 400];
const NOW = "now";
const SLOT_MINUTES = 15;
const SLOTS_BACK = 48; // 12 hours of earlier times

const DRAFT_FILL = { "fill-color": ALERT_RED, "fill-opacity": 0.16 };
const DRAFT_LINE = { "line-color": ALERT_RED, "line-width": 2, "line-dasharray": [2, 1.5] };
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type Spot = { lat: number; lng: number };

function errorText(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function clampRadius(meters: number): number {
  const rounded = Math.round(meters / 5) * 5;
  return Math.min(ALERT_RADIUS.max, Math.max(ALERT_RADIUS.min, rounded));
}

// Red when pressed: on this page every choice is part of an alert.
function Chip({
  pressed,
  onPress,
  children,
}: {
  pressed: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Toggle
      variant="outline"
      pressed={pressed}
      onPressedChange={onPress}
      className="shrink-0 rounded-full border-border bg-background px-3 tabular-nums active:scale-[0.97] aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground/85 aria-pressed:hover:text-background motion-reduce:active:scale-100"
    >
      {children}
    </Toggle>
  );
}

function ChipGroup({
  id,
  label,
  error,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <p id={id} className="text-sm leading-none font-medium">
          {label}
        </p>
        {aside}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-xs font-medium text-pretty text-destructive">
      {children}
    </p>
  );
}

// A click on the map itself places the alert. Clicks on markers are theirs.
function PickSpot({ onPick }: { onPick: (spot: Spot) => void }) {
  const { map } = useMap();
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!map) return;
    const onClick = (event: { lngLat: { lng: number; lat: number }; originalEvent: MouseEvent }) => {
      const clicked = event.originalEvent.target;
      if (clicked instanceof Element && clicked.closest(".maplibregl-marker")) return;
      pick.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    };
    map.on("click", onClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  return null;
}

// The circle being placed: drag the dot to move it, drag the ring handle to resize it.
function Draft({
  spot,
  radius,
  onMove,
  onResize,
}: {
  spot: Spot | null;
  radius: number;
  onMove: (spot: Spot) => void;
  onResize: (radius: number) => void;
}) {
  // While the handle is dragged it stays under the pointer. At rest it sits on the east edge.
  const [dragged, setDragged] = useState<Spot | null>(null);
  const data = useMemo(
    () =>
      spot
        ? ({ type: "Feature", properties: {}, geometry: circlePolygon(spot.lat, spot.lng, radius) } as const)
        : EMPTY,
    [spot, radius],
  );
  const edge = spot ? pointAt(spot.lat, spot.lng, radius, 90) : null;
  const handle = dragged ?? (edge ? { lng: edge[0], lat: edge[1] } : null);

  return (
    <>
      <MapGeoJSON id="alert-draft" data={data} fillPaint={DRAFT_FILL} linePaint={DRAFT_LINE} />
      {spot && (
        <MapMarker
          longitude={spot.lng}
          latitude={spot.lat}
          anchor="center"
          draggable
          zIndex={7}
          onDrag={onMove}
          onDragEnd={onMove}
        >
          <MarkerContent>
            <span
              role="img"
              aria-label="Center of the alert. Drag to move it."
              className="relative block size-4 cursor-grab rounded-full border-2 border-white bg-red-600 shadow-md after:absolute after:-inset-3 active:cursor-grabbing"
            />
          </MarkerContent>
        </MapMarker>
      )}
      {spot && handle && (
        <MapMarker
          longitude={handle.lng}
          latitude={handle.lat}
          anchor="center"
          draggable
          zIndex={8}
          onDrag={(at) => {
            setDragged(at);
            onResize(clampRadius(distanceMeters(spot, at)));
          }}
          onDragEnd={() => setDragged(null)}
        >
          <MarkerContent>
            <span
              role="img"
              aria-label="Edge of the alert. Drag to change its size."
              className="relative block size-4 cursor-ew-resize rounded-full border-2 border-red-600 bg-white shadow-md after:absolute after:-inset-3"
            />
          </MarkerContent>
        </MapMarker>
      )}
    </>
  );
}

// "Now", then every quarter hour back for half a day.
function useTimeOptions() {
  const [base] = useState(() => Date.now());
  return useMemo(() => {
    const step = SLOT_MINUTES * 60_000;
    const first = Math.floor((base - 60_000) / step) * step;
    const earlier = Array.from({ length: SLOTS_BACK }, (_, index) => {
      const iso = new Date(first - index * step).toISOString();
      return { value: iso, label: alertTime(iso, base) };
    });
    return [{ value: NOW, label: "Now" }, ...earlier];
  }, [base]);
}

function AlertRow({
  alert,
  now,
  children,
  note,
}: {
  alert: SafetyAlert;
  now: number;
  note: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-medium text-pretty break-words">{alert.title}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {alertCategoryLabel(alert.category)}, happened at {alertTime(alert.occurredAt, now)}, {note}
        </p>
      </div>
      {children}
    </li>
  );
}

export function AlertDesk() {
  const active = useSafetyAlerts();
  const times = useTimeOptions();

  const [spot, setSpot] = useState<Spot | null>(null);
  const [radius, setRadius] = useState(100);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<AlertCategory | null>(null);
  const [happened, setHappened] = useState(NOW);
  const [hours, setHours] = useState<AlertDuration>(4);
  const [offCampus, setOffCampus] = useState(false);
  const [tried, setTried] = useState(false);
  const [posting, setPosting] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);

  const [ended, setEnded] = useState<{ list: SafetyAlert[]; loading: boolean; error: boolean }>({
    list: [],
    loading: true,
    error: false,
  });
  const loadEnded = useCallback(async () => {
    try {
      const list = await listEndedAlerts();
      setEnded({ list, loading: false, error: false });
    } catch {
      setEnded((current) => ({ ...current, loading: false, error: true }));
    }
  }, []);
  // Reloads on every change, and when an active alert runs out by itself.
  const activeCount = active.alerts.length;
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!cancelled) loadEnded();
    };
    load();
    const unsubscribe = subscribeToAlerts(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadEnded, activeCount]);

  function place(next: Spot) {
    if (!inAlertBounds(next.lat, next.lng)) {
      setOffCampus(true);
      // A new object puts a dragged dot back where it was.
      setSpot((current) => (current ? { ...current } : current));
      return;
    }
    setOffCampus(false);
    setSpot(next);
  }

  const titleError =
    title.trim().length < 3
      ? "Say what happened."
      : namesAnAddress(title)
        ? "Leave out street addresses and room numbers. The circle shows where."
        : null;
  const detailsError = namesAnAddress(details)
    ? "Leave out street addresses and room numbers. The circle shows where."
    : null;
  const spotError = offCampus
    ? "Alerts are for the campus only. Pick a spot on campus."
    : !spot
      ? "Click the map to place the alert."
      : null;
  const categoryError = category ? null : "Pick a category.";
  // An address is flagged as it is typed. The rest waits for the first try.
  const showTitleError = titleError && (tried || title.trim().length >= 3);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    if (posting || !spot || !category || titleError || detailsError) return;
    setPosting(true);
    try {
      await postAlert({
        title,
        details: details.trim() || null,
        category,
        lat: spot.lat,
        lng: spot.lng,
        radiusM: radius,
        occurredAt: happened === NOW ? new Date().toISOString() : happened,
        hours,
      });
      toast.success("Alert posted", { description: "It is on the campus map now." });
      setSpot(null);
      setTitle("");
      setDetails("");
      setCategory(null);
      setHappened(NOW);
      setRadius(100);
      setHours(4);
      setTried(false);
      active.reload();
    } catch (error) {
      toast.error("Could not post the alert", { description: errorText(error, "Try again.") });
    } finally {
      setPosting(false);
    }
  }

  async function allClear(alert: SafetyAlert) {
    if (clearing) return;
    setClearing(alert.id);
    try {
      await clearAlert(alert.id);
      toast.success("All clear", { description: `"${alert.title}" is off the map.` });
      await Promise.all([active.reload(), loadEnded()]);
    } catch (error) {
      toast.error("Could not clear the alert", { description: errorText(error, "Try again.") });
    } finally {
      setClearing(null);
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="relative h-72 overflow-hidden rounded-xl border sm:h-96 lg:h-full lg:min-h-[34rem]">
            <Map center={SFSU_CENTER} zoom={15.4} theme="light" styles={STYLES} maxPitch={0} dragRotate={false}>
              <MapControls position="top-right" showZoom />
              <PickSpot onPick={place} />
              <SafetyAlertLayer dark={false} />
              <Draft spot={spot} radius={radius} onMove={place} onResize={setRadius} />
            </Map>
            {!spot && (
              <p className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-sm font-medium whitespace-nowrap shadow-md ring-1 ring-foreground/10">
                <MousePointerClick aria-hidden="true" className="size-4 text-muted-foreground" />
                Click the map to place the alert
              </p>
            )}
          </div>
          {(offCampus || (tried && spotError)) && <div className="mt-1.5"><FieldError>{spotError}</FieldError></div>}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Field
            id="alert-title"
            label="What happened"
            hint={showTitleError ? undefined : "What happened and where on campus. Never describe a person."}
          >
            <Input
              id="alert-title"
              value={title}
              maxLength={80}
              autoComplete="off"
              placeholder="Gas smell near the science building"
              aria-invalid={showTitleError ? true : undefined}
              onChange={(event) => setTitle(event.target.value)}
            />
            {showTitleError && <FieldError>{titleError}</FieldError>}
          </Field>

          <ChipGroup id="alert-category" label="Category" error={tried ? categoryError : null}>
            {ALERT_CATEGORIES.map((item) => (
              <Chip key={item.id} pressed={category === item.id} onPress={() => setCategory(item.id)}>
                {item.label}
              </Chip>
            ))}
          </ChipGroup>

          <Field
            id="alert-details"
            label="What to do"
            optional
            hint={detailsError ? undefined : "For example which way to walk. No names, no home addresses."}
          >
            <Textarea
              id="alert-details"
              value={details}
              maxLength={280}
              rows={2}
              placeholder="Use the north entrance until it is clear."
              aria-invalid={detailsError ? true : undefined}
              onChange={(event) => setDetails(event.target.value)}
            />
            {detailsError && <FieldError>{detailsError}</FieldError>}
          </Field>

          <ChipGroup
            id="alert-size"
            label="Size"
            aside={
              <span className="text-xs text-muted-foreground tabular-nums">
                {SIZES.includes(radius) ? "Or drag the edge of the circle" : `${radius} m`}
              </span>
            }
          >
            {SIZES.map((size) => (
              <Chip key={size} pressed={radius === size} onPress={() => setRadius(size)}>
                {size} m
              </Chip>
            ))}
          </ChipGroup>

          <div className="flex min-w-0 flex-col gap-1.5">
            <p id="alert-when" className="text-sm leading-none font-medium">
              When it happened
            </p>
            <Select items={times} value={happened} onValueChange={(next) => next && setHappened(next)}>
              <SelectTrigger aria-labelledby="alert-when" className="w-full tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="max-h-72">
                {times.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="tabular-nums">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ChipGroup id="alert-hours" label="Stays on the map for">
            {ALERT_DURATIONS.map((option) => (
              <Chip key={option} pressed={hours === option} onPress={() => setHours(option)}>
                {option === 1 ? "1 hour" : `${option} hours`}
              </Chip>
            ))}
          </ChipGroup>

          <div className="mt-auto space-y-2">
            <Button type="submit" size="lg" className="h-10 w-full" disabled={posting} aria-busy={posting}>
              {posting ? (
                <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
              ) : (
                <TriangleAlert aria-hidden="true" />
              )}
              {posting ? "Posting" : "Post alert"}
            </Button>
            <p className="text-xs text-pretty text-muted-foreground">
              Everyone sees it on the map as posted by Campus safety, with the time. Your name is not shown.
            </p>
          </div>
        </div>
      </form>

      <section aria-labelledby="active-heading">
        <h2 id="active-heading" className="font-heading text-lg font-medium">
          On the map now
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border">
          {active.loading ? (
            <div aria-busy="true" className="space-y-2 px-4 py-3">
              <p role="status" className="sr-only">
                Loading alerts
              </p>
              <Skeleton className="h-5 w-64 max-w-full motion-reduce:animate-none" />
              <Skeleton className="h-4 w-80 max-w-full motion-reduce:animate-none" />
            </div>
          ) : active.error && active.alerts.length === 0 ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span>Could not load alerts.</span>
              <Button variant="outline" size="sm" onClick={active.reload}>
                Try again
              </Button>
            </div>
          ) : active.alerts.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No active alerts.</p>
          ) : (
            <ul className="divide-y">
              {active.alerts.map((alert) => {
                const pending = clearing === alert.id;
                return (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    now={active.now}
                    note={`shown until ${alertTime(alert.expiresAt, active.now)}`}
                  >
                    <Button
                      variant="outline"
                      className={cn("h-9 px-3", pending && "cursor-progress")}
                      disabled={clearing !== null}
                      aria-busy={pending}
                      onClick={() => allClear(alert)}
                    >
                      {pending ? (
                        <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
                      ) : (
                        <Check aria-hidden="true" />
                      )}
                      {pending ? "Clearing" : "All clear"}
                    </Button>
                  </AlertRow>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="ended-heading">
        <h2 id="ended-heading" className="font-heading text-lg font-medium">
          Recently ended
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border">
          {ended.loading ? (
            <div aria-busy="true" className="space-y-2 px-4 py-3">
              <p role="status" className="sr-only">
                Loading ended alerts
              </p>
              <Skeleton className="h-5 w-64 max-w-full motion-reduce:animate-none" />
              <Skeleton className="h-4 w-80 max-w-full motion-reduce:animate-none" />
            </div>
          ) : ended.error && ended.list.length === 0 ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span>Could not load ended alerts.</span>
              <Button variant="outline" size="sm" onClick={loadEnded}>
                Try again
              </Button>
            </div>
          ) : ended.list.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nothing in the last two days.</p>
          ) : (
            <ul className="divide-y text-muted-foreground">
              {ended.list.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  now={active.now}
                  note={
                    alert.clearedAt
                      ? `cleared at ${alertTime(alert.clearedAt, active.now)}`
                      : `ran out at ${alertTime(alert.expiresAt, active.now)}`
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
