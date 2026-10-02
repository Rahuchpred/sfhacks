"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEvent } from "@/lib/db";
import type {
  Building,
  CampusEvent,
  CheckEventRequest,
  CheckEventResponse,
  EventDraft,
  EventIssue,
  ExtractEventRequest,
  ExtractEventResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Field, fieldControlProps, selectClass } from "./field";
import {
  errorMessage,
  fromLocalInput,
  parseTags,
  postJson,
  toLocalInput,
  useLeaveWarning,
} from "./form-utils";
import { ImageDrop } from "./image-drop";
import { IssueList } from "./issue-list";

type Values = {
  title: string;
  clubName: string;
  buildingId: string;
  room: string;
  startsAt: string; // datetime-local value
  endsAt: string;
  description: string;
  tags: string; // comma separated
  hasFood: boolean;
};
type FieldKey = keyof Values;

const EMPTY: Values = {
  title: "",
  clubName: "",
  buildingId: "",
  room: "",
  startsAt: "",
  endsAt: "",
  description: "",
  tags: "",
  hasFood: false,
};

// The model does not always use our exact field names.
const FIELD_ALIASES: Record<string, FieldKey> = {
  title: "title",
  name: "title",
  clubname: "clubName",
  club: "clubName",
  organizer: "clubName",
  buildingid: "buildingId",
  building: "buildingId",
  location: "buildingId",
  room: "room",
  startsat: "startsAt",
  start: "startsAt",
  date: "startsAt",
  time: "startsAt",
  endsat: "endsAt",
  end: "endsAt",
  description: "description",
  tags: "tags",
  hasfood: "hasFood",
  food: "hasFood",
};

function resolveField(name: string): FieldKey | null {
  return FIELD_ALIASES[name.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

function toDraft(values: Values): EventDraft {
  return {
    title: values.title.trim() || null,
    description: values.description.trim() || null,
    clubName: values.clubName.trim() || null,
    buildingId: values.buildingId || null,
    room: values.room.trim() || null,
    startsAt: fromLocalInput(values.startsAt),
    endsAt: fromLocalInput(values.endsAt),
    tags: parseTags(values.tags),
    hasFood: values.hasFood,
  };
}

// Rules that need no model: they run on every render once a check was asked for.
function localIssues(values: Values): EventIssue[] {
  const issues: EventIssue[] = [];
  const required: [FieldKey, string][] = [
    ["title", "Add a title."],
    ["clubName", "Add the club or organizer."],
    ["buildingId", "Pick a building."],
    ["startsAt", "Add a start time."],
    ["endsAt", "Add an end time."],
  ];
  for (const [field, message] of required) {
    if (!String(values[field]).trim()) issues.push({ field, message, severity: "error" });
  }
  if (values.startsAt && values.endsAt && values.endsAt <= values.startsAt) {
    issues.push({ field: "endsAt", message: "The end must be after the start.", severity: "error" });
  }
  return issues;
}

type CheckState = "idle" | "checking" | "fresh" | "stale" | "failed";

export function EventForm({ buildings }: { buildings: Building[] }) {
  const router = useRouter();

  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  const [values, setValues] = useState<Values>(EMPTY);
  const [missing, setMissing] = useState<Set<FieldKey>>(new Set());

  const [check, setCheck] = useState<CheckEventResponse | null>(null);
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [checkError, setCheckError] = useState<string | null>(null);
  const checkId = useRef(0);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState<CampusEvent | null>(null);

  async function runCheck(current: Values) {
    const id = ++checkId.current;
    setCheckState("checking");
    setCheckError(null);
    try {
      const result = await postJson<CheckEventRequest, CheckEventResponse>(
        "/api/ai/check-event",
        { event: toDraft(current) },
      );
      if (id !== checkId.current) return;
      const issues = [...result.issues];
      const end = fromLocalInput(current.endsAt);
      if (end && Date.parse(end) < Date.now()) {
        issues.push({ field: "endsAt", message: "This event has already ended.", severity: "error" });
      }
      setCheck({ ...result, issues });
      setCheckState("fresh");
    } catch (error) {
      if (id !== checkId.current) return;
      setCheckError(errorMessage(error, "The check did not respond."));
      setCheckState("failed");
    }
  }

  // After the first check, every edit reruns it once the organizer pauses.
  const recheck = useEffectEvent(() => runCheck(values));
  useEffect(() => {
    if (checkState !== "stale") return;
    const timer = setTimeout(recheck, 1200);
    return () => clearTimeout(timer);
  }, [checkState, values]);

  function update<K extends FieldKey>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "hasFood" && missing.has(key)) {
      setMissing((current) => new Set([...current].filter((field) => field !== key)));
    }
    if (checkState !== "idle") {
      checkId.current++; // drop any reply for the old values
      setCheckState("stale");
    }
  }

  async function extract() {
    setExtracting(true);
    setExtractError(null);
    try {
      const result = await postJson<ExtractEventRequest, ExtractEventResponse>(
        "/api/ai/extract-event",
        { text: text.trim() || undefined, imageUrl: flyerUrl ?? undefined },
      );
      const draft = result.event;
      const next: Values = {
        title: draft.title ?? "",
        clubName: draft.clubName ?? "",
        buildingId: buildings.some((building) => building.id === draft.buildingId)
          ? (draft.buildingId ?? "")
          : "",
        room: draft.room ?? "",
        startsAt: toLocalInput(draft.startsAt),
        endsAt: toLocalInput(draft.endsAt),
        description: draft.description ?? "",
        tags: draft.tags.join(", "),
        hasFood: draft.hasFood ?? false,
      };

      const nextMissing = new Set<FieldKey>();
      for (const name of result.missing) {
        const key = resolveField(name);
        if (key) nextMissing.add(key);
      }
      for (const key of ["title", "clubName", "buildingId", "room", "startsAt", "endsAt"] as const) {
        if (!next[key]) nextMissing.add(key);
      }
      if (draft.hasFood === null) nextMissing.add("hasFood");

      setValues(next);
      setMissing(nextMissing);
      setConfidence(result.confidence);
      runCheck(next);
    } catch (error) {
      setExtractError(errorMessage(error, "Could not read that. Try again or fill in the form."));
    } finally {
      setExtracting(false);
    }
  }

  useLeaveWarning(!published && (values !== EMPTY || flyerUrl !== null || text !== ""));

  const showIssues = checkState !== "idle";
  const local = localIssues(values);
  const allIssues = showIssues ? [...local, ...(check?.issues ?? [])] : [];
  const byField = new Map<FieldKey, EventIssue[]>();
  const general: EventIssue[] = [];
  for (const issue of allIssues) {
    const key = resolveField(issue.field);
    if (key) byField.set(key, [...(byField.get(key) ?? []), issue]);
    else general.push(issue);
  }
  const errorCount = allIssues.filter((issue) => issue.severity === "error").length;
  const warnCount = allIssues.length - errorCount;
  const checked = checkState === "fresh" || checkState === "failed";
  const canPublish = checked && errorCount === 0 && local.length === 0 && !publishing && !uploading;

  const needs = (key: FieldKey) =>
    missing.has(key) && (key === "hasFood" || values[key] === "");

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    const startsAt = fromLocalInput(values.startsAt);
    const endsAt = fromLocalInput(values.endsAt);
    if (!canPublish || !startsAt || !endsAt) return;

    setPublishing(true);
    setPublishError(null);
    try {
      const created = await createEvent({
        title: values.title.trim(),
        description: values.description.trim(),
        clubName: values.clubName.trim(),
        buildingId: values.buildingId,
        room: values.room.trim() || null,
        startsAt,
        endsAt,
        tags: parseTags(values.tags),
        hasFood: values.hasFood,
        flyerUrl,
        source: flyerUrl ? "flyer" : "organizer",
      });
      setPublished(created);
      toast.success("Event published", {
        description: "It is live on the map now.",
        action: { label: "View map", onClick: () => router.push("/map") },
      });
    } catch (error) {
      setPublishError(errorMessage(error, "Could not publish. Try again."));
    } finally {
      setPublishing(false);
    }
  }

  function reset() {
    checkId.current++;
    setFlyerUrl(null);
    setText("");
    setExtractError(null);
    setConfidence(null);
    setValues(EMPTY);
    setMissing(new Set());
    setCheck(null);
    setCheckState("idle");
    setCheckError(null);
    setPublishError(null);
    setPublished(null);
  }

  if (published) {
    const building = buildings.find((item) => item.id === published.buildingId);
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-primary/5 px-6 py-10 text-center">
        <CircleCheck className="size-10 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold text-balance">{published.title} is live</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Students can see it on the map now
          {building ? `, pinned at ${building.name}` : ""}.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href="/map" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
            View it on the map
          </Link>
          <Button variant="outline" size="lg" className="h-10 px-4" onClick={reset}>
            Post another event
          </Button>
        </div>
      </div>
    );
  }

  const busy = extracting || publishing;

  return (
    <form onSubmit={publish} className="flex flex-col gap-8" noValidate>
      <section aria-labelledby="event-source" className="flex flex-col gap-4">
        <div>
          <h2 id="event-source" className="text-base font-semibold">
            1. Start from anything
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Add a flyer, paste rough notes, or both. AI drafts the form and you correct it. You
            can also skip this and type the details yourself.
          </p>
        </div>

        <ImageDrop
          label="Add a flyer"
          value={flyerUrl}
          onChange={setFlyerUrl}
          onUploadingChange={setUploading}
          disabled={busy}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="event-text">Or paste rough text</Label>
          <Textarea
            id="event-text"
            name="notes"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="boba + board games thurs 5pm cesar chavez, rosa parks room, free boba, all majors…"
            className="min-h-24"
            disabled={busy}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            className="h-10 px-4"
            onClick={extract}
            disabled={busy || uploading || (!flyerUrl && !text.trim())}
          >
            {extracting ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Sparkles aria-hidden />
            )}
            {extracting ? "Reading…" : "Fill in the form with AI"}
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {extracting ? "This can take up to half a minute." : ""}
          </p>
        </div>
        {extractError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {extractError}
          </p>
        )}
      </section>

      <section aria-labelledby="event-details" className="flex flex-col gap-4">
        <h2 id="event-details" className="text-base font-semibold">
          2. Check the details
        </h2>

        {confidence !== null && (
          <p className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-pretty">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium">AI draft, {Math.round(confidence * 100)}% confident.</span>{" "}
              It can misread a flyer. Review every field. Nothing is published until you press
              Publish.
            </span>
          </p>
        )}

        <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field
            id="event-title"
            label="Title"
            needsInput={needs("title")}
            issues={byField.get("title")}
            className="sm:col-span-2"
          >
            <Input
              {...fieldControlProps("event-title", byField.get("title"))}
              name="title"
              autoComplete="off"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </Field>

          <Field
            id="event-club"
            label="Club or organizer"
            needsInput={needs("clubName")}
            issues={byField.get("clubName")}
            className="sm:col-span-2"
          >
            <Input
              {...fieldControlProps("event-club", byField.get("clubName"))}
              name="club"
              autoComplete="off"
              value={values.clubName}
              onChange={(event) => update("clubName", event.target.value)}
            />
          </Field>

          <Field
            id="event-building"
            label="Building"
            needsInput={needs("buildingId")}
            issues={byField.get("buildingId")}
          >
            <select
              {...fieldControlProps("event-building", byField.get("buildingId"))}
              name="building"
              className={selectClass}
              value={values.buildingId}
              onChange={(event) => update("buildingId", event.target.value)}
            >
              <option value="">
                {buildings.length === 0 ? "Loading buildings…" : "Choose a building"}
              </option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="event-room"
            label="Room"
            optional
            needsInput={needs("room")}
            issues={byField.get("room")}
          >
            <Input
              {...fieldControlProps("event-room", byField.get("room"))}
              name="room"
              autoComplete="off"
              value={values.room}
              onChange={(event) => update("room", event.target.value)}
            />
          </Field>

          <Field
            id="event-start"
            label="Starts"
            needsInput={needs("startsAt")}
            issues={byField.get("startsAt")}
          >
            <Input
              {...fieldControlProps("event-start", byField.get("startsAt"))}
              name="starts"
              type="datetime-local"
              value={values.startsAt}
              onChange={(event) => update("startsAt", event.target.value)}
            />
          </Field>

          <Field
            id="event-end"
            label="Ends"
            needsInput={needs("endsAt")}
            issues={byField.get("endsAt")}
          >
            <Input
              {...fieldControlProps("event-end", byField.get("endsAt"))}
              name="ends"
              type="datetime-local"
              min={values.startsAt || undefined}
              value={values.endsAt}
              onChange={(event) => update("endsAt", event.target.value)}
            />
          </Field>

          <Field
            id="event-description"
            label="Description"
            optional
            issues={byField.get("description")}
            className="sm:col-span-2"
          >
            <Textarea
              {...fieldControlProps("event-description", byField.get("description"))}
              name="description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>

          <Field
            id="event-tags"
            label="Tags"
            optional
            hint="Separate with commas, for example: social, cultural, career."
            issues={byField.get("tags")}
            className="sm:col-span-2"
          >
            <Input
              {...fieldControlProps("event-tags", byField.get("tags"))}
              name="tags"
              autoComplete="off"
              value={values.tags}
              onChange={(event) => update("tags", event.target.value)}
            />
          </Field>

          <Field
            id="event-food"
            label="Free food"
            needsInput={needs("hasFood")}
            issues={byField.get("hasFood")}
            className="sm:col-span-2"
          >
            <label className="flex min-h-8 w-fit cursor-pointer items-center gap-2 text-sm">
              <input
                {...fieldControlProps("event-food", byField.get("hasFood"))}
                name="hasFood"
                type="checkbox"
                className="size-4 accent-accent"
                checked={values.hasFood}
                onChange={(event) => update("hasFood", event.target.checked)}
              />
              There will be free food at this event
            </label>
          </Field>
        </fieldset>

        {check && showIssues && <IssueList issues={general} questions={check.questions} />}
      </section>

      <section
        aria-label="Check and publish"
        className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <p aria-live="polite" className="flex items-center gap-2 text-sm text-pretty">
          {(checkState === "checking" || checkState === "stale") && (
            <>
              <Loader2
                className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
                aria-hidden
              />
              {checkState === "stale" ? "Rechecking after your edit…" : "Checking your event. This can take up to half a minute…"}
            </>
          )}
          {checkState === "idle" && (
            <span className="text-muted-foreground">Run the check to unlock Publish.</span>
          )}
          {checkState === "fresh" && errorCount > 0 && (
            <span className="font-medium text-destructive">
              Fix {errorCount} {errorCount === 1 ? "problem" : "problems"} to publish.
            </span>
          )}
          {checkState === "fresh" && errorCount === 0 && (
            <span>
              <span className="font-medium">No blocking problems.</span>{" "}
              {warnCount > 0
                ? `${warnCount} ${warnCount === 1 ? "warning" : "warnings"} to look at, but you can publish.`
                : "Ready to publish."}
            </span>
          )}
          {checkState === "failed" && (
            <span>
              <span className="font-medium">The AI check is unavailable.</span>{" "}
              {errorCount > 0
                ? "Fix the marked fields, then review the rest yourself."
                : "Review the details yourself before you publish."}
              {checkError ? ` (${checkError})` : ""}
            </span>
          )}
        </p>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 px-4"
            onClick={() => runCheck(values)}
            disabled={busy || checkState === "checking"}
          >
            {checkState === "idle" ? "Check event" : "Check again"}
          </Button>
          <Button type="submit" size="lg" className="h-10 px-4" disabled={!canPublish}>
            {publishing && (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            )}
            {publishing ? "Publishing…" : "Publish event"}
          </Button>
        </div>
      </section>

      {publishError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {publishError}
        </p>
      )}
    </form>
  );
}
