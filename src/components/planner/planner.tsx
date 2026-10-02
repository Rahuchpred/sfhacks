"use client";

// Reference: v0 "What do you want to create?" with voice input (Mobbin, web):
// one centered prompt box that the spoken words land in, the recording state
// shown inside it. The microphone itself follows Microsoft Copilot voice mode
// (see mic-button.tsx), and the results follow DoorDash Merchant (plan-results.tsx).
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/components/post/form-utils";
import { savePrefill } from "@/components/post/prefill";
import { listMyClubs } from "@/lib/db";
import type { PlanEventResponse, PlanOption } from "@/lib/planner-types";
import type { MyClub } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MicButton } from "./mic-button";
import { PlanResults } from "./plan-results";
import { planEvent } from "./planner-api";
import { useSpeech } from "./use-speech";

const JUST_ME = "me";
const MIN_LENGTH = 10;

export function Planner() {
  const router = useRouter();
  const [text, setText] = useState("");
  // What was typed before the microphone was turned on. Speech is added after it.
  const spokenAfter = useRef("");
  const [note, setNote] = useState<string | null>(null);

  const [clubs, setClubs] = useState<MyClub[]>([]);
  const [clubId, setClubId] = useState<string | null>(null);

  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<PlanEventResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  // The text the current plan was made from.
  const [plannedText, setPlannedText] = useState<string | null>(null);
  const planId = useRef(0);

  const [opening, setOpening] = useState<number | null>(null);
  const [, startNavigation] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listMyClubs()
      .then((list) => {
        if (cancelled) return;
        setClubs(list);
        if (list.length > 0) setClubId(list[0].id);
      })
      .catch(() => {
        // Planning still works without a club.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function makePlan(transcript: string) {
    const id = ++planId.current;
    setPlanning(true);
    setPlanError(null);
    setPlannedText(transcript);
    try {
      const result = await planEvent({ transcript, clubId: clubId ?? undefined });
      if (id !== planId.current) return;
      setPlan(result);
    } catch (error) {
      if (id !== planId.current) return;
      setPlanError(errorMessage(error, "Could not plan that."));
    } finally {
      if (id === planId.current) setPlanning(false);
    }
  }

  const withSpeech = (spoken: string) => [spokenAfter.current, spoken].filter(Boolean).join(" ");

  const speech = useSpeech({
    onLive: (spoken) => setText(withSpeech(spoken)),
    // The one automatic AI call: when the host stops talking.
    onDone: (spoken) => {
      if (!spoken) {
        setNote("Did not catch that");
        return;
      }
      const full = withSpeech(spoken);
      setText(full);
      makePlan(full);
    },
  });

  function startTalking() {
    spokenAfter.current = text.trim();
    setNote(null);
    speech.start();
  }

  const listening = speech.status === "listening";
  const hearing = speech.status !== "idle";
  const trimmed = text.trim();
  const canPlan = !hearing && !planning && trimmed.length >= MIN_LENGTH && trimmed !== plannedText;

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (canPlan) makePlan(trimmed);
  }

  function use(option: PlanOption, index: number) {
    if (!plan) return;
    const club = clubs.find((item) => item.id === clubId);
    savePrefill({
      title: plan.idea.title,
      description: plan.idea.description,
      tags: plan.idea.tags,
      hasFood: plan.idea.hasFood,
      clubId: club?.id ?? null,
      clubName: club?.name ?? "",
      buildingId: option.buildingId,
      room: option.room,
      startsAt: option.startsAt,
      endsAt: option.endsAt,
    });
    setOpening(index);
    startNavigation(() => router.push("/post"));
  }

  const downloading = speech.download !== null;
  const percent = Math.round((speech.download ?? 0) * 100);
  const statusLine = speech.error
    ? speech.error
    : listening
      ? "Listening"
      : speech.status === "transcribing"
        ? "Writing it down"
        : (note ?? "Tap and talk");

  const clubItems = [
    { value: JUST_ME, label: "Just me" },
    ...clubs.map((club) => ({ value: club.id, label: club.name })),
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4">
        <MicButton
          status={speech.status}
          level={speech.level}
          disabled={planning}
          onStart={startTalking}
          onStop={speech.stop}
        />

        <div className="flex min-h-10 flex-col items-center gap-1.5" aria-live="polite">
          <p
            className={cn(
              "text-sm font-medium",
              speech.error ? "text-destructive" : !hearing && "text-muted-foreground",
            )}
          >
            {statusLine}
          </p>
          {downloading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Speech model, one time</span>
              <span
                role="progressbar"
                aria-label="Speech model download"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className="block h-full origin-left rounded-full bg-primary transition-transform duration-200 ease-linear motion-reduce:transition-none"
                  style={{ transform: `scaleX(${percent / 100})` }}
                />
              </span>
              <span className="w-8 tabular-nums">{percent}%</span>
            </div>
          )}
        </div>

        <form
          onSubmit={submit}
          className={cn(
            "flex w-full flex-col rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
            listening && "border-primary/50",
          )}
        >
          <label htmlFor="plan-idea-text" className="sr-only">
            Your event idea
          </label>
          <textarea
            id="plan-idea-text"
            name="idea"
            autoComplete="off"
            rows={3}
            value={text}
            readOnly={hearing}
            disabled={planning}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Or type it: boba and board games night next week, about 40 people, 2 hours…"
            className="field-sizing-content max-h-60 min-h-24 w-full resize-none bg-transparent px-4 pt-4 text-base outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2 p-2.5">
            {clubs.length > 0 ? (
              <Select
                items={clubItems}
                value={clubId ?? JUST_ME}
                onValueChange={(id) => setClubId(id === JUST_ME ? null : id)}
              >
                <SelectTrigger
                  aria-label="Club"
                  className="h-9 max-w-[60%] border-transparent bg-muted/60"
                  disabled={planning || hearing}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {clubItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" className="h-9 px-3.5" disabled={!canPlan}>
              {planning ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <ArrowUp aria-hidden />
              )}
              {planning ? "Planning…" : "Plan it"}
            </Button>
          </div>
        </form>
      </div>

      <div aria-live="polite" aria-busy={planning}>
        {planning ? (
          <div className="flex flex-col gap-6" role="status" aria-label="Planning">
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          </div>
        ) : planError ? (
          <div
            role="alert"
            className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center"
          >
            <p className="text-sm font-medium text-destructive">{planError}</p>
            <Button variant="outline" size="lg" onClick={() => makePlan(trimmed)}>
              Try again
            </Button>
          </div>
        ) : (
          plan && <PlanResults plan={plan} opening={opening} onUse={use} />
        )}
      </div>
    </div>
  );
}
