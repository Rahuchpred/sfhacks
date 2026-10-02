"use client";

// Reference: Sweatpals "Create event" (Mobbin, web): cover image beside a short
// stack of rows, a large name field and one Publish button. The date and time
// block follows Square "New project" (see when-picker.tsx). The forecast card
// under "Where" follows Calendly "New one-off meeting" (see planner/slot-check.tsx).
import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import {
  AlignLeft,
  CircleCheck,
  Clock,
  DollarSign,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { checkEventDraft, EVENT_TAGS, FOOD_OPTIONS } from "@/lib/checks";
import { createEvent, listMyClubs, updateEvent } from "@/lib/db";
import type {
  Building,
  CampusEvent,
  EventDraft,
  EventIssue,
  ExtractEventRequest,
  ExtractEventResponse,
  MyClub,
} from "@/lib/types";
import type { PlanOption } from "@/lib/planner-types";
import { cn } from "@/lib/utils";
import { SlotCheck } from "@/components/planner/slot-check";
import { fieldControlProps, IssueLine } from "./field";
import {
  daysBetween,
  errorMessage,
  pacificIso,
  pacificParts,
  postJson,
  useLeaveWarning,
} from "./form-utils";
import { ImageDrop } from "./image-drop";
import type { EventPrefill } from "./prefill";
import { WhenPicker, withStart, type When } from "./when-picker";

type Values = {
  title: string;
  clubId: string | null; // null is "Just me"
  clubName: string;
  buildingId: string;
  room: string;
  when: When;
  description: string;
  tags: string[];
  hasFood: boolean;
  foodItems: string[];
  cost: string; // dollars as typed, "" when not given
};

const NO_WHEN: When = { date: "", start: "", end: "", endDays: 0 };

const EMPTY: Values = {
  title: "",
  clubId: null,
  clubName: "",
  buildingId: "",
  room: "",
  when: NO_WHEN,
  description: "",
  tags: [],
  hasFood: false,
  foodItems: [],
  cost: "",
};

// Start and end instants to the one date, start time and end time the form shows.
function toWhen(startsAt: string | null, endsAt: string | null): When | null {
  const start = pacificParts(startsAt);
  if (!start) return null;
  const end = pacificParts(endsAt);
  if (!end) return withStart({ ...NO_WHEN, date: start.date }, start.time);
  return {
    date: start.date,
    start: start.time,
    end: end.time,
    endDays: Math.max(0, daysBetween(start.date, end.date)),
  };
}

function fromEvent(event: CampusEvent): Values {
  return {
    title: event.title,
    clubId: event.clubId,
    clubName: event.clubName,
    buildingId: event.buildingId,
    room: event.room ?? "",
    when: toWhen(event.startsAt, event.endsAt) ?? NO_WHEN,
    description: event.description,
    tags: event.tags,
    hasFood: event.hasFood,
    foodItems: event.foodItems,
    cost: event.cost === null ? "" : String(event.cost),
  };
}

function fromPrefill(prefill: EventPrefill): Values {
  return {
    ...EMPTY,
    title: prefill.title,
    clubId: prefill.clubId,
    clubName: prefill.clubName,
    buildingId: prefill.buildingId,
    room: prefill.room,
    when: toWhen(prefill.startsAt, prefill.endsAt) ?? NO_WHEN,
    description: prefill.description,
    tags: prefill.tags.filter((tag) => (EVENT_TAGS as readonly string[]).includes(tag)),
    hasFood: prefill.hasFood,
  };
}

function toDraft(values: Values): EventDraft {
  const { date, start, end, endDays } = values.when;
  return {
    title: values.title.trim() || null,
    description: values.description.trim() || null,
    clubName: values.clubName.trim() || null,
    buildingId: values.buildingId || null,
    room: values.room.trim() || null,
    startsAt: pacificIso(date, start),
    endsAt: pacificIso(date, end, endDays),
    tags: values.tags,
    hasFood: values.hasFood,
    foodItems: values.hasFood ? values.foodItems : [],
  };
}

// Digits and one decimal point, two places at most.
function cleanCost(value: string): string {
  const [whole, ...rest] = value.replace(/[^\d.]/g, "").split(".");
  return rest.length > 0 ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

function toCost(value: string): number | null {
  const cost = Number(value);
  return value !== "" && Number.isFinite(cost) ? cost : null;
}

const JUST_ME = "me";
// Pasted notes are read once the organizer stops typing for this long.
const NOTES_PAUSE_MS = 1500;
const NOTES_MIN_LENGTH = 15;

type Reading = { state: "idle" | "reading" | "done" | "failed"; from: "flyer" | "notes" };
type Group = "title" | "club" | "when" | "where";

const issueKey = (issue: EventIssue) => `${issue.field}|${issue.message}`;
const inputKey = (flyerUrl: string | null, text: string) => `${flyerUrl ?? ""}\n${text.trim()}`;

export type EventFormProps = {
  buildings: Building[];
  // Set to edit an existing event: no AI draft step, and saving updates it.
  initial?: CampusEvent;
  // Set when the organizer picked an option on /plan: the new event starts filled in.
  prefill?: EventPrefill;
  onSaved?: (event: CampusEvent) => void;
  onCancel?: () => void;
  // Set when the page around the form starts over too: "Post another event" calls it.
  onStartOver?: () => void;
};

export function EventForm({
  buildings,
  initial,
  prefill,
  onSaved,
  onCancel,
  onStartOver,
}: EventFormProps) {
  const editing = initial !== undefined;
  const [startValues] = useState<Values>(() =>
    initial ? fromEvent(initial) : prefill ? fromPrefill(prefill) : EMPTY,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [mountedAt] = useState(() => Date.now());

  const [flyerUrl, setFlyerUrl] = useState<string | null>(initial?.flyerUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState("");
  const [reading, setReading] = useState<Reading>({ state: "idle", from: "notes" });
  const [readError, setReadError] = useState<string | null>(null);
  // What the AI last read. Null until the first read, which is the only automatic one.
  const [readKey, setReadKey] = useState<string | null>(null);
  const readId = useRef(0);

  const [values, setValues] = useState<Values>(startValues);
  const [clubs, setClubs] = useState<MyClub[]>([]);
  // Empty required fields are only marked after the AI draft or a publish attempt.
  const [showMissing, setShowMissing] = useState(editing);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState<CampusEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyClubs()
      .then((list) => {
        if (!cancelled) setClubs(list);
      })
      .catch(() => {
        // "Just me" still works without the club list.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: "tags" | "foodItems", item: string) {
    const list = values[key];
    update(key, list.includes(item) ? list.filter((other) => other !== item) : [...list, item]);
  }

  function chooseClub(id: string | null) {
    const club = clubs.find((item) => item.id === id);
    setValues((current) => {
      const previous = clubs.find((item) => item.id === current.clubId);
      // Leaving a club clears its name, unless the organizer typed their own.
      const clubName = club
        ? club.name
        : previous && current.clubName === previous.name
          ? ""
          : current.clubName;
      return { ...current, clubId: club ? club.id : null, clubName };
    });
  }

  async function read(url: string | null, notes: string) {
    const id = ++readId.current;
    setReadKey(inputKey(url, notes));
    setReading({ state: "reading", from: url ? "flyer" : "notes" });
    setReadError(null);
    try {
      const result = await postJson<ExtractEventRequest, ExtractEventResponse>(
        "/api/ai/extract-event",
        { text: notes.trim() || undefined, imageUrl: url ?? undefined },
      );
      if (id !== readId.current) return;
      const draft = result.event;
      const when = toWhen(draft.startsAt, draft.endsAt);
      const tags = draft.tags.filter((tag) => (EVENT_TAGS as readonly string[]).includes(tag));
      const foodItems = (draft.foodItems ?? []).filter((item) =>
        (FOOD_OPTIONS as readonly string[]).includes(item),
      );
      const club = clubs.find(
        (item) => item.name.toLowerCase() === draft.clubName?.trim().toLowerCase(),
      );
      // Anything the AI could not find keeps what is already in the form.
      setValues((current) => ({
        ...current,
        title: draft.title ?? current.title,
        clubId: club ? club.id : current.clubId,
        clubName: draft.clubName ?? current.clubName,
        buildingId: buildings.some((building) => building.id === draft.buildingId)
          ? (draft.buildingId ?? "")
          : current.buildingId,
        room: draft.room ?? current.room,
        when: when ?? current.when,
        description: draft.description ?? current.description,
        tags: tags.length > 0 ? tags : current.tags,
        hasFood: foodItems.length > 0 ? true : (draft.hasFood ?? current.hasFood),
        foodItems: foodItems.length > 0 ? foodItems : current.foodItems,
      }));
      setShowMissing(true);
      setReading((current) => ({ ...current, state: "done" }));
    } catch (error) {
      if (id !== readId.current) return;
      setReadError(errorMessage(error, "Could not read that."));
      setReading((current) => ({ ...current, state: "failed" }));
    }
  }

  // The one automatic read: when notes are pasted and the typing has stopped.
  const readNotes = useEffectEvent(() => read(flyerUrl, text));
  const waitingForNotes =
    !editing && readKey === null && !uploading && text.trim().length >= NOTES_MIN_LENGTH;
  useEffect(() => {
    if (!waitingForNotes) return;
    const timer = setTimeout(readNotes, NOTES_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [waitingForNotes, text]);

  function changeFlyer(url: string | null) {
    setFlyerUrl(url);
    // The one automatic read: when the first flyer lands.
    if (url && !editing && readKey === null) read(url, text);
  }

  // One click on a better slot from the forecast card moves the event there.
  function applySlot(slot: PlanOption) {
    setValues((current) => ({
      ...current,
      when: toWhen(slot.startsAt, slot.endsAt) ?? current.when,
      buildingId: buildings.some((building) => building.id === slot.buildingId)
        ? slot.buildingId
        : current.buildingId,
      room: slot.room || current.room,
    }));
  }

  const dirty = values !== startValues || flyerUrl !== (initial?.flyerUrl ?? null) || text !== "";
  useLeaveWarning(!published && dirty);

  // Instant checks in the browser. Saving an event that already happened
  // (to add its cost, say) must not trip the "already ended" rule.
  const draft = toDraft(values);
  const checked =
    buildings.length > 0
      ? checkEventDraft(draft, buildings, editing ? new Date(0) : undefined)
      : [];
  const empty: Record<Group, boolean> = {
    title: !draft.title,
    club: !draft.clubName,
    when: !values.when.date || !values.when.start || !values.when.end,
    where: !draft.buildingId,
  };
  // An empty required field is marked "Required" instead of listed as a problem.
  const isEmptyField = (issue: EventIssue) =>
    (issue.field === "title" && empty.title) ||
    (issue.field === "buildingId" && empty.where) ||
    (issue.field === "startsAt" && !draft.startsAt) ||
    (issue.field === "endsAt" && !draft.endsAt);
  const problems = checked.filter((issue) => !isEmptyField(issue));
  const issuesFor = (...fields: string[]) =>
    problems.filter((issue) => fields.includes(issue.field));
  const errorCount = problems.filter((issue) => issue.severity === "error").length;
  const emptyCount = Object.values(empty).filter(Boolean).length;
  const required = (group: Group) => showMissing && empty[group];
  const blocked = errorCount + (showMissing ? emptyCount : 0);

  // The forecast card needs a place and a time that has not passed. It never blocks anything.
  const slotRequest =
    draft.buildingId &&
    draft.startsAt &&
    draft.endsAt &&
    new Date(draft.endsAt) > new Date(draft.startsAt) &&
    new Date(draft.endsAt).getTime() > mountedAt
      ? {
          clubId: values.clubId ?? undefined,
          tags: values.tags,
          buildingId: draft.buildingId,
          room: draft.room ?? undefined,
          startsAt: draft.startsAt,
          endsAt: draft.endsAt,
          hasFood: values.hasFood,
          expectedPeople: prefill?.expectedPeople ?? undefined,
        }
      : null;

  const isReading = reading.state === "reading";
  const busy = isReading || publishing;
  const canPublish = buildings.length > 0 && blocked === 0 && !busy && !uploading;

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!canPublish) return;
    if (emptyCount > 0 || !draft.startsAt || !draft.endsAt) {
      setShowMissing(true);
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }

    setPublishing(true);
    setPublishError(null);
    const fields = {
      title: values.title.trim(),
      description: values.description.trim(),
      clubName: values.clubName.trim(),
      clubId: values.clubId,
      buildingId: values.buildingId,
      room: values.room.trim() || null,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      tags: values.tags,
      hasFood: values.hasFood,
      foodItems: values.hasFood ? values.foodItems : [],
      cost: toCost(values.cost),
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
        toast.success("Event published");
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
    readId.current++;
    setFlyerUrl(null);
    setText("");
    setReading({ state: "idle", from: "notes" });
    setReadError(null);
    setReadKey(null);
    setValues(startValues);
    setShowMissing(false);
    setPublishError(null);
    setPublished(null);
  }

  if (published) {
    const building = buildings.find((item) => item.id === published.buildingId);
    const big = "h-10 px-4";
    return (
      <div className="mx-auto flex w-full max-w-2xl animate-in flex-col items-center gap-3 rounded-xl border bg-primary/5 px-6 py-10 text-center duration-200 ease-out fade-in-0 zoom-in-95 motion-reduce:animate-none">
        <CircleCheck className="size-10 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold text-balance break-words">
          {published.title} is live
        </h2>
        {building && <p className="text-sm text-muted-foreground">Pinned at {building.name}</p>}
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
            Check guests in
          </Link>
        </div>
        <Button variant="ghost" size="lg" className={big} onClick={onStartOver ?? reset}>
          Post another event
        </Button>
      </div>
    );
  }

  const tile = "rounded-xl bg-muted/60";
  const rowLabel = "flex items-center gap-2 text-sm font-medium";
  const control = "h-9 border-transparent bg-background dark:bg-background";
  const chip =
    "h-8 touch-manipulation rounded-full border px-3 text-sm transition-[color,background-color,border-color,scale] duration-150 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:active:scale-100";
  const action = editing ? "save" : "publish";

  const whenIssues = issuesFor("startsAt", "endsAt");
  const whereIssues = issuesFor("buildingId", "room");
  const titleIssues = issuesFor("title");

  const clubItems = [
    { value: JUST_ME, label: "Just me" },
    ...clubs.map((club) => ({ value: club.id, label: club.name })),
  ];
  // An event being edited shows its club before the club list has loaded.
  if (values.clubId && !clubs.some((club) => club.id === values.clubId)) {
    clubItems.push({ value: values.clubId, label: startValues.clubName || "Club" });
  }
  const buildingItems = buildings.map((building) => ({ value: building.id, label: building.name }));

  const hasInput = flyerUrl !== null || text.trim() !== "";
  const canReread =
    readKey !== null &&
    !isReading &&
    !uploading &&
    hasInput &&
    (reading.state === "failed" || readKey !== inputKey(flyerUrl, text));

  return (
    <form
      ref={formRef}
      onSubmit={publish}
      className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]"
      noValidate
    >
      <section aria-label="Flyer and notes" className="flex flex-col gap-3">
        <ImageDrop
          square
          label="Add a flyer"
          hint={editing ? undefined : "Drop it here and the form fills itself."}
          value={flyerUrl}
          onChange={changeFlyer}
          onUploadingChange={setUploading}
          disabled={busy}
        />

        {!editing && (
          <div className={cn(tile, "flex flex-col gap-2 p-3")}>
            <Label htmlFor="event-text">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Or paste your notes
            </Label>
            <Textarea
              id="event-text"
              name="notes"
              autoComplete="off"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="boba + board games thurs 5pm cesar chavez, free boba…"
              className="min-h-20 bg-background"
              disabled={isReading}
            />
            {(readError || canReread) && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs">
                {readError && (
                  <span role="alert" className="font-medium text-destructive">
                    {readError}
                  </span>
                )}
                {canReread && (
                  <button
                    type="button"
                    onClick={() => read(flyerUrl, text)}
                    className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {reading.state === "failed" ? "Try again" : "Re-read"}
                  </button>
                )}
              </p>
            )}
          </div>
        )}

        {/* Sits under what is being read, so the fields beside it never jump. */}
        <div aria-live="polite">
          {isReading && (
            <p className="flex animate-in flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm duration-200 ease-out fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
              <Loader2
                className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
                aria-hidden
              />
              <span className="font-medium">
                Reading your {reading.from === "flyer" ? "flyer" : "notes"}
              </span>
              <span className="text-muted-foreground">About 30 seconds</span>
            </p>
          )}
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="sr-only">Event details</h2>

        <fieldset
          disabled={busy}
          className={cn(
            "flex min-w-0 flex-col gap-3 transition-opacity duration-200",
            isReading && "opacity-50",
          )}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="event-title" className="sr-only">
              Event name
            </label>
            <input
              id="event-title"
              aria-invalid={
                required("title") || titleIssues.some((issue) => issue.severity === "error") || undefined
              }
              aria-describedby={titleIssues.length > 0 ? "event-title-issues" : undefined}
              name="title"
              autoComplete="off"
              placeholder="Event name"
              className="w-full min-w-0 border-b border-transparent bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/45 focus-visible:border-ring aria-invalid:border-destructive sm:text-4xl"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
            />
            {required("title") && <Required />}
            <BlockIssues id="event-title-issues" issues={titleIssues} />
          </div>

          <div role="group" aria-labelledby="event-host" className={cn(tile, "flex flex-col gap-2 p-3")}>
            <p id="event-host" className={rowLabel}>
              <Users className="size-4 text-muted-foreground" aria-hidden />
              Hosted by
              {required("club") && <Required />}
            </p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <Select
                items={clubItems}
                value={values.clubId ?? JUST_ME}
                onValueChange={(id) => chooseClub(id === JUST_ME ? null : id)}
              >
                <SelectTrigger aria-label="Club" className={cn(control, "w-full")}>
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
              <Input
                id="event-club"
                aria-label="Club or organizer"
                aria-invalid={required("club") || undefined}
                name="club"
                autoComplete="off"
                placeholder="Club or organizer"
                className={control}
                value={values.clubName}
                onChange={(event) => update("clubName", event.target.value)}
              />
            </div>
          </div>

          <div role="group" aria-labelledby="event-when" className={cn(tile, "flex flex-col gap-2 p-3")}>
            <p id="event-when" className={rowLabel}>
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              When
              {required("when") && <Required />}
            </p>
            <WhenPicker
              value={values.when}
              onChange={(when) => update("when", when)}
              showMissing={showMissing}
              describedBy={whenIssues.length > 0 ? "event-when-issues" : undefined}
            />
            <BlockIssues id="event-when-issues" issues={whenIssues} />
          </div>

          <div role="group" aria-labelledby="event-where" className={cn(tile, "flex flex-col gap-2 p-3")}>
            <p id="event-where" className={rowLabel}>
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              Where
              {required("where") && <Required />}
            </p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Select
                items={buildingItems}
                value={values.buildingId || null}
                onValueChange={(id) => update("buildingId", id ?? "")}
              >
                <SelectTrigger
                  aria-label="Building"
                  aria-invalid={
                    required("where") ||
                    whereIssues.some((issue) => issue.severity === "error") ||
                    undefined
                  }
                  aria-describedby={whereIssues.length > 0 ? "event-where-issues" : undefined}
                  className={cn(control, "w-full")}
                >
                  <SelectValue
                    placeholder={buildings.length === 0 ? "Loading buildings…" : "Building"}
                  />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="max-h-72">
                  {buildingItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="event-room"
                aria-label="Room, optional"
                name="room"
                autoComplete="off"
                placeholder="Room (optional)"
                className={control}
                value={values.room}
                onChange={(event) => update("room", event.target.value)}
              />
            </div>
            <BlockIssues id="event-where-issues" issues={whereIssues} />
          </div>

          <SlotCheck request={slotRequest} onApply={applySlot} />

          <div className={cn(tile, "flex flex-col gap-2 p-3")}>
            <label htmlFor="event-description" className={rowLabel}>
              <AlignLeft className="size-4 text-muted-foreground" aria-hidden />
              Description
              <Optional />
            </label>
            <Textarea
              {...fieldControlProps("event-description", issuesFor("description"))}
              name="description"
              autoComplete="off"
              className="min-h-20 border-transparent bg-background dark:bg-background"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
            />
            <BlockIssues id="event-description-issues" issues={issuesFor("description")} />
          </div>

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
                      onClick={() => toggle("tags", tag)}
                      className={cn(
                        chip,
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
            </div>

            <div className="flex flex-col gap-2 p-3">
              <label className="flex min-h-8 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Utensils className="size-4 text-muted-foreground" aria-hidden />
                  Free food
                </span>
                <Switch
                  name="hasFood"
                  aria-label="Free food"
                  className="data-checked:bg-accent"
                  checked={values.hasFood}
                  onCheckedChange={(on) => update("hasFood", on)}
                />
              </label>
              {values.hasFood && (
                <div
                  role="group"
                  aria-label="What food"
                  className="flex animate-in flex-wrap gap-1.5 duration-150 ease-out fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
                >
                  {FOOD_OPTIONS.map((item) => {
                    const on = values.foodItems.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle("foodItems", item)}
                        className={cn(
                          chip,
                          on
                            ? "border-accent bg-accent text-accent-foreground hover:bg-accent/85"
                            : "border-transparent bg-background hover:bg-background/60",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex min-h-14 items-center justify-between gap-3 p-3">
              <label htmlFor="event-cost" className={cn(rowLabel, "flex-wrap")}>
                <DollarSign className="size-4 text-muted-foreground" aria-hidden />
                What did it cost?
                <Optional />
              </label>
              <div className="relative w-28 shrink-0">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
                >
                  $
                </span>
                <Input
                  id="event-cost"
                  name="cost"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className={cn(control, "pl-6 text-right tabular-nums")}
                  value={values.cost}
                  onChange={(event) => update("cost", cleanCost(event.target.value))}
                />
              </div>
            </div>
          </div>
        </fieldset>

        <section aria-label={editing ? "Save" : "Publish"} className="mt-2 flex flex-col gap-2">
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={!canPublish}>
            {publishing && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {editing
              ? publishing
                ? "Saving…"
                : "Save changes"
              : publishing
                ? "Publishing…"
                : "Publish event"}
          </Button>
          <p aria-live="polite" className="min-h-5 text-center text-sm font-medium text-destructive">
            {blocked > 0 && !isReading && `Fix ${blocked} ${blocked === 1 ? "thing" : "things"} to ${action}`}
          </p>
          {publishError && (
            <p role="alert" className="text-center text-sm font-medium text-destructive">
              {publishError}
            </p>
          )}
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="mx-auto h-9 px-3"
              onClick={onCancel}
              disabled={publishing}
            >
              Cancel
            </Button>
          )}
        </section>
      </div>
    </form>
  );
}

function Required() {
  return <span className="text-xs font-medium text-destructive">Required</span>;
}

function Optional() {
  return <span className="text-xs font-normal text-muted-foreground">Optional</span>;
}

// Problems for a block (When, Where), shown once under its fields.
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
