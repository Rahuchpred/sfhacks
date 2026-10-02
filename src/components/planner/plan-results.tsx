"use client";

// Reference: DoorDash Merchant "Set a schedule" (Mobbin, web): bordered option
// cards, the recommended one marked, one short reason line under each. The
// time on each card is set large like the slot chips in Calendly's meeting poll.
import { CircleCheck, Clock, Loader2, MapPin, Users, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlanEventResponse, PlanOption } from "@/lib/planner-types";
import { cn } from "@/lib/utils";
import { dayLabel, durationLabel, peopleRange, rangeLabel, shareLabel } from "./format";

const CONFIDENCE = { low: "Rough guess", medium: "Fair guess", high: "Solid guess" } as const;

const enter =
  "animate-in duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] fill-mode-backwards fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none";

type PlanResultsProps = {
  plan: PlanEventResponse;
  // Index of the option being opened in the post form, if any.
  opening: number | null;
  onUse: (option: PlanOption, index: number) => void;
};

export function PlanResults({ plan, opening, onUse }: PlanResultsProps) {
  const { idea, forecast, options, source } = plan;
  const chips = [
    // Food has its own gold chip.
    ...idea.tags.filter((tag) => tag !== "free food"),
    idea.expectedPeople !== null ? `${idea.expectedPeople} people` : null,
    durationLabel(idea.durationMinutes),
    idea.when || null,
  ].filter((chip): chip is string => chip !== null);

  return (
    <div className="flex flex-col gap-6">
      <div className={cn("grid gap-3 md:grid-cols-2", enter)}>
        <section aria-labelledby="plan-idea" className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4">
          <h2 id="plan-idea" className="text-xs font-medium text-muted-foreground">
            Understood
          </h2>
          <p className="text-xl font-semibold tracking-tight text-balance break-words">{idea.title}</p>
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <li key={chip} className="rounded-full bg-background px-2.5 py-1 text-xs">
                {chip}
              </li>
            ))}
            {idea.hasFood && (
              <li className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                <Utensils className="size-3" aria-hidden />
                Food
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="plan-forecast" className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="plan-forecast" className="text-xs font-medium text-muted-foreground">
              Turnout
            </h2>
            <Badge variant="outline">{CONFIDENCE[forecast.confidence]}</Badge>
          </div>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {peopleRange(forecast)}
            </span>
            <span className="text-sm text-muted-foreground">people</span>
            {forecast.food && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground tabular-nums">
                <Utensils className="size-3" aria-hidden />
                {forecast.food.portions} portions
              </span>
            )}
          </p>
          <p className="text-sm text-pretty text-muted-foreground">{forecast.reason}</p>
        </section>
      </div>

      <section aria-labelledby="plan-options" className="flex flex-col gap-3">
        <div className={cn("flex items-center gap-2", enter)} style={{ animationDelay: "60ms" }}>
          <h2 id="plan-options" className="text-sm font-medium">
            {options.length === 1 ? "1 option" : `${options.length} options`}
          </h2>
          {source.sample && <Badge variant="outline">Sample schedule</Badge>}
        </div>

        {options.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No free room found. Try another day or a shorter event.
          </p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3">
            {options.map((option, index) => (
              <li
                key={`${option.buildingId}|${option.room}|${option.startsAt}`}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-card p-4",
                  index === 0 && "border-primary/50 ring-3 ring-primary/10",
                  enter,
                )}
                style={{ animationDelay: `${100 + index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{dayLabel(option.startsAt)}</span>
                    <span className="text-lg font-semibold tracking-tight tabular-nums">
                      {rangeLabel(option.startsAt, option.endsAt)}
                    </span>
                  </p>
                  {index === 0 && <Badge>Best</Badge>}
                </div>

                <ul className="flex flex-col gap-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 break-words">
                      {option.buildingName}
                      {option.room && <span className="text-muted-foreground">, {option.room}</span>}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="tabular-nums">Fits {option.capacity}</span>
                  </li>
                  {option.clashes.length === 0 ? (
                    <li className="flex items-center gap-2">
                      <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
                      No clashes
                    </li>
                  ) : (
                    option.clashes.map((clash) => (
                      <li key={`${clash.kind}|${clash.label}`} className="flex items-start gap-2">
                        <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 break-words">
                          {clash.label}
                          {shareLabel(clash) && (
                            <span className="text-muted-foreground tabular-nums">
                              , {shareLabel(clash)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))
                  )}
                </ul>

                <p className="text-sm text-pretty text-muted-foreground">{option.reason}</p>

                <Button
                  size="lg"
                  variant={index === 0 ? "default" : "outline"}
                  className="mt-auto h-10 w-full"
                  disabled={opening !== null}
                  onClick={() => onUse(option, index)}
                >
                  {opening === index && (
                    <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                  )}
                  Use this
                </Button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
