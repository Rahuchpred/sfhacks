"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Utensils } from "lucide-react";
import { listBuildings } from "@/lib/db";
import type { Building } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EventForm } from "./event-form";
import { FoodForm, type FoodPrefill } from "./food-form";
import { errorMessage } from "./form-utils";

export type PostKind = "event" | "food";

const CHOICES = [
  {
    kind: "event",
    title: "An event",
    body: "Start from a flyer or rough notes. Students register and you check them in at the door.",
    icon: CalendarPlus,
  },
  {
    kind: "food",
    title: "Leftover food",
    body: "Take a photo of what is left. Students claim a portion and pick it up.",
    icon: Utensils,
  },
] as const;

export function PostTabs({
  initialKind,
  foodPrefill,
}: {
  initialKind: PostKind | null;
  foodPrefill?: FoodPrefill;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<PostKind | null>(initialKind);
  // A form stays mounted once opened, so switching does not throw away a half-filled one.
  const [opened, setOpened] = useState<PostKind[]>(initialKind ? [initialKind] : []);
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

  function choose(next: PostKind) {
    setKind(next);
    setOpened((current) => (current.includes(next) ? current : [...current, next]));
    // Keep the choice in the URL so it can be linked and survives a reload.
    router.replace(`/post?tab=${next}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="radiogroup"
        aria-labelledby="post-kind"
        className={cn("mx-auto grid w-full max-w-2xl gap-3", "grid-cols-2")}
      >
        {CHOICES.map(({ kind: choice, title, body, icon: Icon }) => {
          const selected = kind === choice;
          const gold = choice === "food";
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(choice)}
              className={cn(
                "flex touch-manipulation flex-col items-start gap-2 rounded-xl border text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                kind === null ? "p-4 sm:p-5" : "p-3",
                selected
                  ? gold
                    ? "border-accent bg-accent/15"
                    : "border-primary bg-primary/10"
                  : "border-input bg-background hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-full",
                    kind === null ? "size-10" : "size-7",
                    gold ? "bg-accent/25 text-accent-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className={kind === null ? "size-5" : "size-4"} aria-hidden />
                </span>
                <span className={cn("font-semibold", kind === null ? "text-base" : "text-sm")}>
                  {title}
                </span>
              </span>
              {kind === null && (
                <span className="text-sm text-pretty text-muted-foreground">{body}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Could not load the building list ({error}). Reload the page to try again.
        </p>
      )}

      {opened.includes("event") && (
        <div hidden={kind !== "event"}>
          <EventForm buildings={buildings} />
        </div>
      )}
      {opened.includes("food") && (
        <div hidden={kind !== "food"} className="mx-auto w-full max-w-2xl">
          <FoodForm buildings={buildings} prefill={foodPrefill} />
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Already posted?{" "}
        <Link
          href="/host"
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          See your events and turnout
        </Link>
      </p>
    </div>
  );
}
