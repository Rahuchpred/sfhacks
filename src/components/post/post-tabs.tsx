"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Utensils } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listBuildings } from "@/lib/db";
import type { Building } from "@/lib/types";
import { EventForm } from "./event-form";
import { FoodForm } from "./food-form";
import { errorMessage } from "./form-utils";

export function PostTabs({ defaultTab }: { defaultTab: "event" | "food" }) {
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
    <Tabs defaultValue={defaultTab} className="gap-6">
      <TabsList className="h-11! w-full">
        <TabsTrigger value="event">
          <CalendarPlus aria-hidden />
          Post an event
        </TabsTrigger>
        <TabsTrigger value="food">
          <Utensils aria-hidden />
          Post leftover food
        </TabsTrigger>
      </TabsList>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Could not load the building list ({error}). Reload the page to try again.
        </p>
      )}

      {/* keepMounted: switching tabs must not throw away a half-filled form. */}
      <TabsContent value="event" keepMounted>
        <EventForm buildings={buildings} />
      </TabsContent>
      <TabsContent value="food" keepMounted>
        <FoodForm buildings={buildings} />
      </TabsContent>
    </Tabs>
  );
}
