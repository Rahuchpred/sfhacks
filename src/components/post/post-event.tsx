"use client";

import { useEffect, useRef, useState } from "react";
import { Planner } from "@/components/planner/planner";
import { listBuildings } from "@/lib/db";
import type { Building } from "@/lib/types";
import { EventForm } from "./event-form";
import { errorMessage } from "./form-utils";
import { takePrefill, type EventPrefill } from "./prefill";

// The post page: an idea box (voice or text) that suggests a room and a time, then the
// event form. Picking a suggestion fills the form. The form also works by itself.
export function PostEvent() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<EventPrefill | null>(null);
  // Counts the picks, so picking another option starts the form over with it.
  const [picks, setPicks] = useState(0);
  // Counts the posted events, so "Post another event" also clears the idea box.
  const [round, setRound] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // After an event is live, the next one starts from an empty idea box and an empty form.
  function startOver() {
    setPrefill(null);
    setPicks((count) => count + 1);
    setRound((count) => count + 1);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  }

  function applyPlan(next: EventPrefill) {
    setPrefill(next);
    setPicks((count) => count + 1);
    requestAnimationFrame(() => {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      formRef.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    });
  }

  useEffect(() => {
    const saved = takePrefill();
    if (saved)
      queueMicrotask(() => {
        setPrefill(saved);
        setPicks((count) => count + 1);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    listBuildings()
      .then((list) => {
        if (!cancelled) setBuildings(list);
      })
      .catch((loadError) => {
        if (!cancelled) setError(errorMessage(loadError, "Unknown error."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div ref={topRef} className="flex scroll-mt-32 flex-col gap-10">
      <Planner key={round} onUse={applyPlan} />
      {error && (
        <p role="alert" className="mx-auto w-full max-w-4xl text-sm font-medium text-destructive">
          Could not load the building list ({error}). Reload the page to try again.
        </p>
      )}
      <div ref={formRef} className="scroll-mt-6">
        <EventForm
          // A picked plan starts the form over with its details.
          key={picks}
          buildings={buildings}
          prefill={prefill ?? undefined}
          onStartOver={startOver}
        />
      </div>
    </div>
  );
}
