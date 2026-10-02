"use client";

import { useEffect, useRef } from "react";
import type { Building } from "@/lib/types";

// The hero background: a campus radar. Every building is a faint dot at its
// real position, a soft wedge of light turns around the center, and a building
// with an upcoming event (or open food) lights up as the sweep passes it.

export type RadarPalette = {
  sweep: string; // the wedge of light and its leading edge
  ring: string; // range rings and resting dots
  event: string; // a building with an upcoming event
  food: string; // a building with open food
};

type RadarCanvasProps = {
  buildings: Building[];
  eventBuildingIds: ReadonlySet<string>;
  foodBuildingIds: ReadonlySet<string>;
  palette: RadarPalette;
};

const TURN_MS = 7000; // one full sweep
const FADE_MS = 2000; // how long a lit building takes to fade back
const TAU = Math.PI * 2;

type Dot = { x: number; y: number; angle: number; kind: "event" | "food" | "none" };

export function RadarCanvas({
  buildings,
  eventBuildingIds,
  foodBuildingIds,
  palette,
}: RadarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    let raf = 0;
    let onScreen = true;

    // Project lat and lng to the canvas so the dots keep the real campus shape,
    // centered and scaled to fill most of the hero.
    function layout() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);

      if (buildings.length === 0) {
        dots = [];
        return;
      }
      const midLat = buildings.reduce((sum, building) => sum + building.lat, 0) / buildings.length;
      const squeeze = Math.cos((midLat * Math.PI) / 180);
      const flat = buildings.map((building) => ({
        building,
        x: building.lng * squeeze,
        y: -building.lat,
      }));
      const xs = flat.map((point) => point.x);
      const ys = flat.map((point) => point.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const spanX = Math.max(...xs) - minX || 1;
      const spanY = Math.max(...ys) - minY || 1;
      const scale = Math.min((width * 0.82) / spanX, (height * 0.74) / spanY);

      dots = flat.map(({ building, x, y }) => {
        const px = width / 2 + (x - minX - spanX / 2) * scale;
        const py = height / 2 + (y - minY - spanY / 2) * scale;
        const angle = (Math.atan2(py - height / 2, px - width / 2) + TAU) % TAU;
        const kind = foodBuildingIds.has(building.id)
          ? "food"
          : eventBuildingIds.has(building.id)
            ? "event"
            : "none";
        return { x: px, y: py, angle, kind };
      });
    }

    function draw(time: number) {
      const cx = width / 2;
      const cy = height / 2;
      const reach = Math.hypot(width, height) / 2;
      const sweep = ((time % TURN_MS) / TURN_MS) * TAU;
      context!.clearRect(0, 0, width, height);

      // Range rings.
      context!.lineWidth = 1;
      context!.strokeStyle = palette.ring;
      context!.globalAlpha = 0.13;
      for (let ring = 1; ring <= 4; ring++) {
        context!.beginPath();
        context!.arc(cx, cy, (reach * ring) / 4, 0, TAU);
        context!.stroke();
      }

      if (!still) {
        // A wedge that trails behind the leading edge.
        const wedge = context!.createConicGradient(sweep, cx, cy);
        wedge.addColorStop(0, "transparent");
        wedge.addColorStop(0.8, "transparent");
        wedge.addColorStop(1, palette.sweep);
        context!.globalAlpha = 0.32;
        context!.fillStyle = wedge;
        context!.beginPath();
        context!.arc(cx, cy, reach, 0, TAU);
        context!.fill();

        context!.globalAlpha = 0.3;
        context!.strokeStyle = palette.sweep;
        context!.beginPath();
        context!.moveTo(cx, cy);
        context!.lineTo(cx + Math.cos(sweep) * reach, cy + Math.sin(sweep) * reach);
        context!.stroke();
      }

      for (const dot of dots) {
        // 1 right as the sweep passes, back to 0 over FADE_MS. A still frame
        // shows every active building lit.
        let glow = 0;
        if (dot.kind !== "none") {
          const since = ((((sweep - dot.angle) % TAU) + TAU) % TAU) / TAU * TURN_MS;
          glow = still ? 1 : Math.max(0, 1 - since / FADE_MS) ** 2;
        }

        context!.fillStyle = palette.ring;
        context!.globalAlpha = 0.42;
        context!.beginPath();
        context!.arc(dot.x, dot.y, 2.5, 0, TAU);
        context!.fill();

        if (glow > 0.01) {
          context!.fillStyle = dot.kind === "food" ? palette.food : palette.event;
          context!.globalAlpha = glow * 0.28;
          context!.beginPath();
          context!.arc(dot.x, dot.y, 8 + glow * 8, 0, TAU);
          context!.fill();
          context!.globalAlpha = glow;
          context!.beginPath();
          context!.arc(dot.x, dot.y, 2.5 + glow * 2.5, 0, TAU);
          context!.fill();
        }
      }
      context!.globalAlpha = 1;
    }

    function loop(time: number) {
      draw(time);
      raf = requestAnimationFrame(loop);
    }

    // The loop only runs while the hero is on screen and the tab is visible.
    // When it is paused, one frame is still painted so the hero is never blank.
    function sync() {
      cancelAnimationFrame(raf);
      if (still) draw(0);
      else if (onScreen && !document.hidden) raf = requestAnimationFrame(loop);
      else draw(performance.now());
    }

    const resize = new ResizeObserver(() => {
      layout();
      if (still || document.hidden) draw(still ? 0 : performance.now());
    });
    const visible = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    layout();
    sync();
    resize.observe(canvas);
    visible.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      visible.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [buildings, eventBuildingIds, foodBuildingIds, palette]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />;
}
