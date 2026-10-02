"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postJson } from "@/lib/api";
import type { CampusEvent, EventRecapResponse } from "@/lib/types";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ai"; text: string }
  | { kind: "error"; message: string };

export function Recap({ event }: { event: CampusEvent }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = useRef(false);

  async function write() {
    if (busy.current) return; // double click
    busy.current = true;
    setState({ kind: "loading" });
    try {
      const result = await postJson<EventRecapResponse>("/api/ai/event-recap", {
        eventId: event.id,
      });
      setState({ kind: "ai", text: result.recap.trim() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not write the recap.";
      setState({ kind: "error", message });
    } finally {
      busy.current = false;
    }
  }

  const loading = state.kind === "loading";
  const done = state.kind === "ai";

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
