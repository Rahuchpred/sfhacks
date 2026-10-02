import type { SafetyAlert } from "@/lib/db-safety";

// The one red in the app. Alerts only.
export const ALERT_RED = "#dc2626";
// On the dark map the same red sinks into the background, so the circle is drawn lighter.
export const ALERT_RED_ON_DARK = "#f87171";

const EARTH_RADIUS_M = 6_371_000;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const toDeg = (radians: number) => (radians * 180) / Math.PI;

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// The point a given distance from the center, at a compass bearing in degrees.
export function pointAt(lat: number, lng: number, meters: number, bearing: number): [number, number] {
  const angular = meters / EARTH_RADIUS_M;
  const lat1 = toRad(lat);
  const theta = toRad(bearing);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(theta),
  );
  const lng2 =
    toRad(lng) +
    Math.atan2(
      Math.sin(theta) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [toDeg(lng2), toDeg(lat2)];
}

// A circle as a polygon in real meters, so it grows with zoom and tilts with the map.
export function circlePolygon(lat: number, lng: number, meters: number, steps = 72): GeoJSON.Polygon {
  const ring = Array.from({ length: steps }, (_, index) =>
    pointAt(lat, lng, meters, (index / steps) * 360),
  );
  ring.push(ring[0]);
  return { type: "Polygon", coordinates: [ring] };
}

export function alertsToGeoJSON(
  alerts: Pick<SafetyAlert, "id" | "lat" | "lng" | "radiusM">[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon, { id: string }> {
  return {
    type: "FeatureCollection",
    features: alerts.map((alert) => ({
      type: "Feature",
      properties: { id: alert.id },
      geometry: circlePolygon(alert.lat, alert.lng, alert.radiusM),
    })),
  };
}

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// "2:40 PM" today, "Oct 1, 2:40 PM" on any other day.
export function alertTime(iso: string, now: number): string {
  const date = new Date(iso);
  const time = timeFormat.format(date);
  return date.toDateString() === new Date(now).toDateString()
    ? time
    : `${dayFormat.format(date)}, ${time}`;
}

// Words that point at a home rather than a place on campus. Checked as the officer types.
const ADDRESS =
  /\b\d{1,5}\s+(?:[a-z0-9.']+\s+){0,3}(?:st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ct|court|ln|lane|way|pl|place)\b|\b(?:apt|apartment|unit|suite|room|rm)\.?\s*#?\s*\d+[a-z]?\b/i;

export function namesAnAddress(text: string): boolean {
  return ADDRESS.test(text);
}
