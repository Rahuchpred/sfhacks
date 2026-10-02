"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, CircleCheck, Loader2, MapPin, Sparkles } from "lucide-react";
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
import { Field, fieldControlProps, IssueLine, selectClass } from "./field";
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
  const blockClass = "flex flex-col gap-3 rounded-xl border bg-muted/40 p-4";

  return (
    <form
      onSubmit={publish}
      className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
      noValidate
    >
      <section aria-labelledby="event-source" className="flex flex-col gap-4">
        <h2 id="event-source" className="text-base font-semibold">
          {editing ? "Flyer" : "Start from a flyer or notes"}
        </h2>

        <ImageDrop
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
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-text">Or paste rough text</Label>
              <Textarea
                id="event-text"
                name="notes"
                autoComplete="off"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="boba + board games thurs 5pm cesar chavez, rosa parks room, free boba…"
                className="min-h-24"
                disabled={busy}
              />
            </div>

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
            <p aria-live="polite" className="text-sm text-pretty text-muted-foreground">
              {extracting
                ? "This can take up to half a minute."
                : "AI drafts the form and you correct it. Or skip this and type the details."}
            </p>
            {extractError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {extractError}
              </p>
            )}
          </>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-5">
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

        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
          <Field
            id="event-title"
            label="Event name"
            needsInput={needs("title")}
            issues={byField.get("title")}
          >
            <Input
              {...fieldControlProps("event-title", byField.get("title"))}
              name="title"
              autoComplete="off"
              className="h-12 text-xl font-semibold md:text-xl"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </Field>

          <Field
            id="event-club"
            label="Club or organizer"
            needsInput={needs("clubName")}
            issues={byField.get("clubName")}
          >
            <Input
              {...fieldControlProps("event-club", byField.get("clubName"))}
              name="club"
              autoComplete="off"
              value={values.clubName}
              onChange={(event) => update("clubName", event.target.value)}
            />
          </Field>

          <div role="group" aria-labelledby="event-when" className={blockClass}>
            <h3 id="event-when" className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              When
              {(needs("startsAt") || needs("endsAt")) && <NeedsInput />}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="event-start" label="Starts">
                <Input
                  {...fieldControlProps("event-start", byField.get("startsAt"))}
                  aria-describedby={whenIssues.length > 0 ? "event-when-issues" : undefined}
                  name="starts"
                  type="datetime-local"
                  className="bg-background"
                  value={values.startsAt}
                  onChange={(event) => update("startsAt", event.target.value)}
                />
              </Field>
              <Field id="event-end" label="Ends">
                <Input
                  {...fieldControlProps("event-end", byField.get("endsAt"))}
                  aria-describedby={whenIssues.length > 0 ? "event-when-issues" : undefined}
                  name="ends"
                  type="datetime-local"
                  className="bg-background"
                  min={values.startsAt || undefined}
                  value={values.endsAt}
                  onChange={(event) => update("endsAt", event.target.value)}
                />
              </Field>
            </div>
            <BlockIssues id="event-when-issues" issues={whenIssues} />
          </div>

          <div role="group" aria-labelledby="event-where" className={blockClass}>
            <h3 id="event-where" className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-primary" aria-hidden />
              Where
              {(needs("buildingId") || needs("room")) && <NeedsInput />}
            </h3>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Field id="event-building" label="Building">
                <select
                  {...fieldControlProps("event-building", byField.get("buildingId"))}
                  aria-describedby={whereIssues.length > 0 ? "event-where-issues" : undefined}
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
              <Field id="event-room" label="Room" optional>
                <Input
                  {...fieldControlProps("event-room", byField.get("room"))}
                  aria-describedby={whereIssues.length > 0 ? "event-where-issues" : undefined}
                  name="room"
                  autoComplete="off"
                  className="bg-background"
                  value={values.room}
                  onChange={(event) => update("room", event.target.value)}
                />
              </Field>
            </div>
            <BlockIssues id="event-where-issues" issues={whereIssues} />
          </div>

          <Field
            id="event-description"
            label="Description"
            optional
            issues={byField.get("description")}
          >
            <Textarea
              {...fieldControlProps("event-description", byField.get("description"))}
              name="description"
              autoComplete="off"
              className="min-h-24"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>

          <div role="group" aria-labelledby="event-tags" className="flex flex-col gap-2">
            <p id="event-tags" className="flex items-center gap-2 text-sm leading-none font-medium">
              Tags <span className="text-xs font-normal text-muted-foreground">Optional</span>
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
                        : "border-input bg-background hover:bg-muted",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <BlockIssues id="event-tags-issues" issues={byField.get("tags") ?? []} />
          </div>

          <Field
            id="event-food"
            label="Free food"
            needsInput={needs("hasFood")}
            issues={byField.get("hasFood")}
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

        <section
          aria-label={editing ? "Check and save" : "Check and publish"}
          className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
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
                    Fix {errorCount} {errorCount === 1 ? "problem" : "problems"} to{" "}
                    {editing ? "save" : "publish"}. Checking the rest…
                  </span>
                ) : (
                  "Checking your event. This can take up to half a minute…"
                )}
              </>
            )}
            {checkState === "idle" && (
              <span className="text-muted-foreground">Run the check to unlock Publish.</span>
            )}
            {checked && errorCount > 0 && (
              <span className="font-medium text-destructive">
                Fix {errorCount} {errorCount === 1 ? "problem" : "problems"} to{" "}
                {editing ? "save" : "publish"}.
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
                    ? `${warnCount} ${warnCount === 1 ? "warning" : "warnings"} to look at, but you can ${editing ? "save" : "publish"}.`
                    : editing
                      ? "Ready to save."
                      : "Ready to publish."}
              </span>
            )}
          </p>

          <div className="flex shrink-0 flex-wrap gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-10 px-4"
                onClick={onCancel}
                disabled={publishing}
              >
                Cancel
              </Button>
            )}
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
              {editing
                ? publishing
                  ? "Saving…"
                  : "Save changes"
                : publishing
                  ? "Publishing…"
                  : "Publish event"}
            </Button>
          </div>
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
