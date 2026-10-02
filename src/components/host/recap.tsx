"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampusEvent } from "@/lib/types";
import { formatEventTime, turnoutRate } from "./host-utils";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ai"; text: string }
  | { kind: "placeholder"; text: string }
  | { kind: "error"; message: string };

const countFormat = new Intl.NumberFormat();

function people(count: number): string {
  return count === 1 ? "1 person" : `${countFormat.format(count)} people`;
}

// Used only while the recap route does not exist. Built from the event's own numbers.
function placeholderRecap(event: CampusEvent, place: string | undefined): string {
  const where = place ? ` at ${place}` : "";
  const intro = `${event.title} ran ${formatEventTime(event)}${where}.`;
  const rate = turnoutRate(event.checkedInCount, event.rsvpCount);
  if (rate === null) return `${intro} No one registered.`;
  return `${intro} ${people(event.rsvpCount)} registered and ${people(
    event.checkedInCount,
  )} checked in, a turnout of ${countFormat.format(rate)}%.`;
}

export function Recap({ event, place }: { event: CampusEvent; place?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = useRef(false);

  async function write() {
    if (busy.current) return; // double click
    busy.current = true;
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/ai/event-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      if (response.status === 404) {
        setState({ kind: "placeholder", text: placeholderRecap(event, place) });
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      const data = (body ?? {}) as { recap?: unknown; error?: unknown };
      if (response.ok && typeof data.recap === "string" && data.recap.trim()) {
        setState({ kind: "ai", text: data.recap.trim() });
      } else {
        const message =
          typeof data.error === "string" && data.error
            ? data.error
            : "Could not write the recap.";
        setState({ kind: "error", message });
      }
    } catch {
      setState({ kind: "error", message: "Could not reach the server. Check your connection." });
    } finally {
      busy.current = false;
    }
  }

  const loading = state.kind === "loading";
  const done = state.kind === "ai" || state.kind === "placeholder";

  return (
    <section aria-labelledby="recap-heading">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="recap-heading">Recap</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <div aria-live="polite" className="flex w-full min-w-0 flex-col gap-2 empty:hidden">
            {loading && (
              <p className="text-sm text-muted-foreground">
                Writing… This can take up to half a minute.
              </p>
            )}
            {state.kind === "ai" && (
              <>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  Written by AI. Check it before you share it.
                </p>
                <p className="text-sm text-pretty break-words whitespace-pre-line">{state.text}</p>
              </>
            )}
            {state.kind === "placeholder" && (
              <>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <FileText aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  Placeholder recap from your event&apos;s numbers. The AI version is not
                  connected yet.
                </p>
                <p className="text-sm text-pretty break-words tabular-nums">{state.text}</p>
              </>
            )}
          </div>
          {state.kind === "error" && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 text-pretty break-words">{state.message}</span>
            </p>
          )}
          <Button
            variant={done ? "outline" : "default"}
            size="lg"
            className="h-10 px-4"
            disabled={loading}
            onClick={write}
          >
            {loading && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            {loading
              ? "Writing…"
              : state.kind === "error"
                ? "Try again"
                : done
                  ? "Write again"
                  : "Write recap"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
