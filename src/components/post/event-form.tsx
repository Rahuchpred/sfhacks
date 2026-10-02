"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import {
  AlignLeft,
  CircleCheck,
  Loader2,
  MapPin,
  Sparkles,
  Tag,
  Users,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkEventDraft, EVENT_TAGS } from "@/lib/checks";
import { createEvent, updateEvent } from "@/lib/db";
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
import { fieldControlProps, IssueLine, selectClass } from "./field";
import {
  errorMessage,
  fromLocalInput,
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
  tags: string[];
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
  tags: [],
  hasFood: false,
};

function fromEvent(event: CampusEvent): Values {
  return {
    title: event.title,
    clubName: event.clubName,
    buildingId: event.buildingId,
    room: event.room ?? "",
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    description: event.description,
    tags: event.tags,
    hasFood: event.hasFood,
  };
}

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
    tags: values.tags,
    hasFood: values.hasFood,
  };
}

const issueKey = (issue: EventIssue) => `${issue.field}|${issue.message}`;

// The exact rules from src/lib/checks.ts, run in the browser so a blocking
// problem shows the moment it is typed. Only these can block publishing.
function codeIssues(values: Values, buildings: Building[]): EventIssue[] {
  if (buildings.length === 0) return [];
  const issues = checkEventDraft(toDraft(values), buildings);
  if (!values.clubName.trim()) {
    issues.push({ field: "clubName", message: "Add the club or organizer.", severity: "error" });
  }
  return issues;
}

type CheckState = "idle" | "checking" | "fresh" | "stale" | "failed";

export type EventFormProps = {
  buildings: Building[];
  // Set to edit an existing event: no AI draft step, and saving updates it.
  initial?: CampusEvent;
  onSaved?: (event: CampusEvent) => void;
  onCancel?: () => void;
};

export function EventForm({ buildings, initial, onSaved, onCancel }: EventFormProps) {
  const editing = initial !== undefined;
  const [startValues] = useState<Values>(() => (initial ? fromEvent(initial) : EMPTY));

  const [flyerUrl, setFlyerUrl] = useState<string | null>(initial?.flyerUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  const [values, setValues] = useState<Values>(startValues);
  const [missing, setMissing] = useState<Set<FieldKey>>(new Set());

  // Model findings and questions from the last check. Always warnings.
  const [check, setCheck] = useState<Pick<CheckEventResponse, "issues" | "questions"> | null>(null);
  // An event being edited is checked right away, a new one once there is something to check.
  const [checkState, setCheckState] = useState<CheckState>(editing ? "stale" : "idle");
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
      // The route repeats the code checks. Those are shown live from the
      // browser, so keep only what the model added.
      const known = new Set(codeIssues(current, buildings).map(issueKey));
      setCheck({
        issues: result.issues
          .filter((issue) => !known.has(issueKey(issue)))
          .map((issue) => ({ ...issue, severity: "warn" as const })),
        questions: result.questions,
      });
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

  function markEdited() {
    if (checkState !== "idle") {
      checkId.current++; // drop any reply for the old values
      setCheckState("stale");
    }
  }

  function update<K extends FieldKey>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "hasFood" && missing.has(key)) {
      setMissing((current) => new Set([...current].filter((field) => field !== key)));
    }
    markEdited();
  }

  function toggleTag(tag: string) {
    update(
      "tags",
      values.tags.includes(tag) ? values.tags.filter((item) => item !== tag) : [...values.tags, tag],
    );
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
        tags: draft.tags.filter((tag) => (EVENT_TAGS as readonly string[]).includes(tag)),
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

  const dirty = values !== startValues || flyerUrl !== (initial?.flyerUrl ?? null) || text !== "";
  useLeaveWarning(!published && dirty);

  const showIssues = checkState !== "idle";
  const local = codeIssues(values, buildings);
  const localKeys = new Set(local.map(issueKey));
  const fromModel = (check?.issues ?? []).filter((issue) => !localKeys.has(issueKey(issue)));
  const allIssues = showIssues ? [...local, ...fromModel] : [];
  const byField = new Map<FieldKey, EventIssue[]>();
  const general: EventIssue[] = [];
  for (const issue of allIssues) {
    const key = resolveField(issue.field);
    if (key) byField.set(key, [...(byField.get(key) ?? []), issue]);
    else general.push(issue);
  }
  const localErrors = local.filter((issue) => issue.severity === "error").length;
  const errorCount = allIssues.filter((issue) => issue.severity === "error").length;
  const warnCount = allIssues.length - errorCount;
  const checked = checkState === "fresh" || checkState === "failed";
  const canPublish =
    checked && buildings.length > 0 && localErrors === 0 && !publishing && !uploading;

  const needs = (key: FieldKey) =>
    missing.has(key) && (key === "hasFood" || values[key] === "");

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    const startsAt = fromLocalInput(values.startsAt);
    const endsAt = fromLocalInput(values.endsAt);
    if (!canPublish || !startsAt || !endsAt) return;

    setPublishing(true);
    setPublishError(null);
    const fields = {
      title: values.title.trim(),
      description: values.description.trim(),
      clubName: values.clubName.trim(),
      buildingId: values.buildingId,
      room: values.room.trim() || null,
      startsAt,
      endsAt,
      tags: values.tags,
      hasFood: values.hasFood,
      flyerUrl,
    };
    try {
      if (initial) {
        const saved = await updateEvent(initial.id, fields);
        toast.success("Changes saved");
        onSaved?.(saved);
      } else {
        const created = await createEvent({ ...fields, source: flyerUrl ? "flyer" : "organizer" });
        setPublished(created);
        toast.success("Event published", { description: "It is live on the map now." });
      }
    } catch (error) {
      setPublishError(
        errorMessage(error, editing ? "Could not save. Try again." : "Could not publish. Try again."),
      );
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
    setValues(startValues);
    setMissing(new Set());
    setCheck(null);
    setCheckState("idle");
    setCheckError(null);
    setPublishError(null);
    setPublished(null);
  }

  if (published) {
    const building = buildings.find((item) => item.id === published.buildingId);
    const big = "h-10 px-4";
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-xl border bg-primary/5 px-6 py-10 text-center">
        <CircleCheck className="size-10 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold text-balance break-words">
          {published.title} is live
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Students can register now
          {building ? `. It is pinned at ${building.name}` : ""}. Check guests in at the door from
          your phone.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href={`/events/${published.id}`} className={cn(buttonVariants({ size: "lg" }), big)}>
            View event page
          </Link>
          <Link
            href={`/host/${published.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), big)}
          >
            Manage
          </Link>
          <Link
            href={`/host/${published.id}/check-in`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), big)}
          >
            Check in
          </Link>
        </div>
        <Button variant="ghost" size="lg" className={big} onClick={reset}>
          Post another event
        </Button>
      </div>
    );
  }

  const busy = extracting || publishing;
  const whenIssues = [...(byField.get("startsAt") ?? []), ...(byField.get("endsAt") ?? [])];
  const whereIssues = [...(byField.get("buildingId") ?? []), ...(byField.get("room") ?? [])];
  const tile = "rounded-xl bg-muted/60";
  const rowLabel = "flex items-center gap-2 text-sm font-medium";
  const action = editing ? "save" : "publish";

  return (
    <form
      onSubmit={publish}
      className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]"
      noValidate
    >
      <section aria-label="Flyer and AI draft" className="flex flex-col gap-3">
        <ImageDrop
          square
          label={editing ? "Add a flyer" : "Add a flyer or cover"}
          value={flyerUrl}
          onChange={(url) => {
            setFlyerUrl(url);
            markEdited();
          }}
          onUploadingChange={setUploading}
          disabled={busy}
        />

        {!editing && (
          <div className={cn(tile, "flex flex-col gap-2 p-3")}>
            <Label htmlFor="event-text">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Draft it with AI
            </Label>
            <Textarea
              id="event-text"
              name="notes"
              autoComplete="off"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste rough notes: boba + board games thurs 5pm cesar chavez, free boba…"
              className="min-h-20 bg-background"
              disabled={busy}
            />
            <Button
              type="button"
              size="lg"
              className="h-10 px-4"
              onClick={extract}
              disabled={busy || uploading || (!flyerUrl && !text.trim())}
            >
              {extracting && (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {extracting ? "Reading…" : "Fill in the form"}
            </Button>
            <p aria-live="polite" className="text-xs text-pretty text-muted-foreground">
              {extracting
                ? "This can take up to half a minute."
                : "Reads your flyer or notes and fills in the form. You correct it. Or skip this and type the details."}
            </p>
            {extractError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {extractError}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="sr-only">Event details</h2>

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

        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={cn(
                  tile,
                  "flex h-8 w-fit max-w-full min-w-0 items-center gap-2 px-2.5 text-sm focus-within:ring-3 focus-within:ring-ring/50",
                )}
              >
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">Club or organizer</span>
                <input
                  {...fieldControlProps("event-club", byField.get("clubName"))}
                  name="club"
                  autoComplete="off"
                  placeholder="Club or organizer"
                  className="w-48 max-w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                  value={values.clubName}
                  onChange={(event) => update("clubName", event.target.value)}
                />
              </label>
              {needs("clubName") && <NeedsInput />}
            </div>
            <BlockIssues id="event-club-issues" issues={byField.get("clubName") ?? []} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="event-title" className="sr-only">
              Event name
            </label>
            <input
              {...fieldControlProps("event-title", byField.get("title"))}
              name="title"
              autoComplete="off"
              placeholder="Event name"
              className="w-full min-w-0 border-b border-transparent bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/45 focus-visible:border-ring aria-invalid:border-destructive sm:text-4xl"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
            />
            {needs("title") && <NeedsInput />}
            <BlockIssues id="event-title-issues" issues={byField.get("title") ?? []} />
          </div>

          <div role="group" aria-label="When" className={cn(tile, "flex flex-col gap-1 p-1.5")}>
            <div className="relative flex flex-col gap-1">
              {/* The dotted line joining the Start and End dots. */}
              <span
                aria-hidden
                className="absolute top-6 bottom-6 left-[0.9rem] border-l border-dotted border-muted-foreground/60"
              />
              {(
                [
                  ["event-start", "Start", "starts", "startsAt"],
                  ["event-end", "End", "ends", "endsAt"],
                ] as const
              ).map(([id, label, name, key]) => (
                <div
                  key={id}
                  className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 py-0.5 pr-0.5 pl-2"
                >
                  <label htmlFor={id} className="flex items-center gap-2.5 text-sm">
                    <span
                      aria-hidden
                      className={cn(
                        "relative size-2.5 shrink-0 rounded-full border border-muted-foreground/70",
                        key === "startsAt" ? "bg-muted-foreground/70" : "bg-muted",
                      )}
                    />
                    {label}
                  </label>
                  <Input
                    {...fieldControlProps(id, byField.get(key))}
                    aria-describedby={whenIssues.length > 0 ? "event-when-issues" : undefined}
                    name={name}
                    type="datetime-local"
                    className="h-9 border-transparent bg-background"
                    min={key === "endsAt" ? values.startsAt || undefined : undefined}
                    value={values[key]}
                    onChange={(event) => update(key, event.target.value)}
                  />
                </div>
              ))}
            </div>
            {(needs("startsAt") || needs("endsAt") || whenIssues.length > 0) && (
              <div className="flex flex-col gap-1 px-2 pb-1.5">
                {(needs("startsAt") || needs("endsAt")) && <NeedsInput />}
                <BlockIssues id="event-when-issues" issues={whenIssues} />
              </div>
            )}
          </div>

          <div
            role="group"
            aria-labelledby="event-where"
            className={cn(tile, "flex flex-col gap-2 p-3")}
          >
            <p id="event-where" className={rowLabel}>
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              Location
              {(needs("buildingId") || needs("room")) && <NeedsInput />}
            </p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <select
                {...fieldControlProps("event-building", byField.get("buildingId"))}
                aria-describedby={whereIssues.length > 0 ? "event-where-issues" : undefined}
                aria-label="Building"
                name="building"
                className={cn(selectClass, "h-9 border-transparent")}
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
              <Input
                {...fieldControlProps("event-room", byField.get("room"))}
                aria-describedby={whereIssues.length > 0 ? "event-where-issues" : undefined}
                aria-label="Room, optional"
                name="room"
                autoComplete="off"
                placeholder="Room (optional)"
                className="h-9 border-transparent bg-background"
                value={values.room}
                onChange={(event) => update("room", event.target.value)}
              />
            </div>
            <BlockIssues id="event-where-issues" issues={whereIssues} />
          </div>

          <div className={cn(tile, "flex flex-col gap-2 p-3")}>
            <label htmlFor="event-description" className={rowLabel}>
              <AlignLeft className="size-4 text-muted-foreground" aria-hidden />
              Description
              <span className="text-xs font-normal text-muted-foreground">Optional</span>
            </label>
            <Textarea
              {...fieldControlProps("event-description", byField.get("description"))}
              aria-describedby={
                byField.has("description") ? "event-description-issues" : undefined
              }
              name="description"
              autoComplete="off"
              className="min-h-20 border-transparent bg-background"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
            />
            <BlockIssues
              id="event-description-issues"
              issues={byField.get("description") ?? []}
            />
          </div>

          <h3 className="mt-2 text-sm font-medium text-muted-foreground">Event options</h3>
          <div className={cn(tile, "divide-y divide-border")}>
            <div role="group" aria-labelledby="event-tags" className="flex flex-col gap-2 p-3">
              <p id="event-tags" className={rowLabel}>
                <Tag className="size-4 text-muted-foreground" aria-hidden />
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TAGS.map((tag) => {
                  const on = values.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "h-8 touch-manipulation rounded-full border px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        on
                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/85"
                          : "border-transparent bg-background hover:bg-background/60",
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <BlockIssues id="event-tags-issues" issues={byField.get("tags") ?? []} />
            </div>

            <div className="flex flex-col gap-1 p-3">
              <label className="flex min-h-8 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                <span className="flex flex-wrap items-center gap-2">
                  <Utensils className="size-4 text-muted-foreground" aria-hidden />
                  Free food at this event
                  {needs("hasFood") && <NeedsInput />}
                </span>
                <input
                  {...fieldControlProps("event-food", byField.get("hasFood"))}
                  name="hasFood"
                  type="checkbox"
                  className="size-5 shrink-0 accent-accent"
                  checked={values.hasFood}
                  onChange={(event) => update("hasFood", event.target.checked)}
                />
              </label>
              <BlockIssues id="event-food-issues" issues={byField.get("hasFood") ?? []} />
            </div>
          </div>
        </fieldset>

        {check && showIssues && <IssueList issues={general} questions={check.questions} />}

        <section
          aria-label={editing ? "Check and save" : "Check and publish"}
          className="mt-2 flex flex-col gap-3"
        >
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-pretty">
            {(checkState === "checking" || checkState === "stale") && (
              <>
                <Loader2
                  className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
                  aria-hidden
                />
                {errorCount > 0 ? (
                  <span className="font-medium text-destructive">
                    Fix {errorCount} {errorCount === 1 ? "problem" : "problems"} to {action}.
                    Checking the rest…
                  </span>
                ) : (
                  "Checking your event. This can take up to half a minute…"
                )}
              </>
            )}
            {checkState === "idle" && (
              <span className="text-muted-foreground">
                Check the event first. It catches wrong dates and missing details.
              </span>
            )}
            {checked && errorCount > 0 && (
              <span className="font-medium text-destructive">
                Fix {errorCount} {errorCount === 1 ? "problem" : "problems"} to {action}.
              </span>
            )}
            {checked && errorCount === 0 && (
              <span>
                <span className="font-medium">
                  {checkState === "failed" ? "The AI check is unavailable." : "No blocking problems."}
                </span>{" "}
                {checkState === "failed"
                  ? `The exact date and place checks passed. Review the rest yourself.${checkError ? ` (${checkError})` : ""}`
                  : warnCount > 0
                    ? `${warnCount} ${warnCount === 1 ? "warning" : "warnings"} to look at, but you can ${action}.`
                    : `Ready to ${action}.`}
              </span>
            )}
          </p>

          {checkState === "idle" ? (
            <Button
              type="button"
              size="lg"
              className="h-11 w-full text-base"
              onClick={() => runCheck(values)}
              disabled={busy}
            >
              Check event
            </Button>
          ) : (
            <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={!canPublish}>
              {publishing && (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {editing
                ? publishing
                  ? "Saving…"
                  : "Save changes"
                : publishing
                  ? "Publishing…"
                  : "Publish event"}
            </Button>
          )}

          {(checkState !== "idle" || onCancel) && (
            <div className="flex flex-wrap justify-center gap-2">
              {checkState !== "idle" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-9 px-3"
                  onClick={() => runCheck(values)}
                  disabled={busy || checkState === "checking"}
                >
                  Check again
                </Button>
              )}
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-9 px-3"
                  onClick={onCancel}
                  disabled={publishing}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}
        </section>

        {publishError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {publishError}
          </p>
        )}
      </div>
    </form>
  );
}

function NeedsInput() {
  return (
    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">
      Needs input
    </span>
  );
}

// Issues for a grouped block (When, Where), shown once under both fields.
function BlockIssues({ id, issues }: { id: string; issues: EventIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul id={id} className="flex flex-col gap-1">
      {issues.map((issue) => (
        <IssueLine key={issueKey(issue)} issue={issue} />
      ))}
    </ul>
  );
}
