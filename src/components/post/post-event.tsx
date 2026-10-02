"use client";

import { useEffect, useState } from "react";
import { listBuildings } from "@/lib/db";
import type { Building } from "@/lib/types";
import { EventForm } from "./event-form";
import { errorMessage } from "./form-utils";

// Loads the building list for the event form on /post.
export function PostEvent() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="mx-auto w-full max-w-4xl text-sm font-medium text-destructive">
          Could not load the building list ({error}). Reload the page to try again.
        </p>
      )}
      <EventForm buildings={buildings} />
    </div>
  );
}
