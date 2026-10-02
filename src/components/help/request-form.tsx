"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Loader2, Plus, Sparkles, X } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/api";
import { createHelpRequest, listBuildings } from "@/lib/db";
import {
  REWARD_TYPES,
  type Building,
  type HelpRequest,
  type RewardType,
  type StructureHelpResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// Mobbin references: Perplexity "New Health Task" (one text box and one button
// to start) for step one, and Cofounder "Create New Skill" (a single column of
// labeled fields with the primary button at the bottom) for the form.

const NO_BUILDING = "none";
const MAX_SKILLS = 6;
const SPOTS = Array.from({ length: 10 }, (_, index) => index + 1);

type Stage = "write" | "reading" | "edit" | "done";

type Draft = {
  title: string;
  description: string;
  requesterName: string;
  department: string;
  buildingId: string | null;
  timeNeeded: string;
  skills: string[];
  spots: number;
  rewardType: RewardType | null;
  rewardDetail: string;
};

type ErrorKey = "title" | "description" | "requesterName" | "department" | "timeNeeded" | "rewardType";

const EMPTY: Draft = {
  title: "",
  description: "",
  requesterName: "",
  department: "",
  buildingId: null,
  timeNeeded: "",
  skills: [],
  spots: 1,
  rewardType: null,
  rewardDetail: "",
};

// Instant checks, no AI. Mirrors what the database accepts.
function validate(draft: Draft): Partial<Record<ErrorKey, string>> {
  const errors: Partial<Record<ErrorKey, string>> = {};
  const title = draft.title.trim();
  if (title.length < 3) errors.title = "Add a title.";
  else if (title.length > 120) errors.title = "Keep it under 120 characters.";
  if (!draft.description.trim()) errors.description = "Say what the student will do.";
  if (!draft.requesterName.trim()) errors.requesterName = "Add your name.";
  if (!draft.department.trim()) errors.department = "Add your department.";
  if (!draft.timeNeeded.trim()) errors.timeNeeded = "Say how long it takes.";
  if (!draft.rewardType) errors.rewardType = "Choose what the student gets.";
  return errors;
}

function label(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function FormField({
  id,
  label: text,
  optional,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-h-5 items-center gap-2">
        <Label htmlFor={id}>{text}</Label>
        {optional && <span className="text-xs text-muted-foreground">Optional</span>}
      </div>
      {children}
      {error && <FieldError id={`${id}-error`} message={error} />}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function RequestForm() {
  const [stage, setStage] = useState<Stage>("write");
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [fromAi, setFromAi] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<ErrorKey, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [created, setCreated] = useState<HelpRequest | null>(null);

  // The AI reads the text exactly once. Skipping only ignores a late answer.
  const started = useRef(false);
  const skipped = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    listBuildings()
      .then((loaded) => {
        if (!cancelled) setBuildings(loaded);
      })
      .catch(() => {
        // Building is optional, so the form still works without the list.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Move focus to the new step so keyboard and screen reader users follow along.
  useEffect(() => {
    if (stage === "edit" || stage === "done") headingRef.current?.focus();
  }, [stage]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function readRequest() {
    const trimmed = text.trim();
    if (!trimmed || started.current) return;
    started.current = true;
    setStage("reading");
    try {
      const result = await postJson<StructureHelpResponse>("/api/ai/structure-help", {
        text: trimmed,
      });
      if (skipped.current) return;
      setDraft({
        ...EMPTY,
        title: result.title,
        description: result.description,
        timeNeeded: result.timeNeeded,
        skills: result.skills.slice(0, MAX_SKILLS),
        rewardType: result.rewardType,
        rewardDetail: result.rewardDetail,
        buildingId: result.buildingId,
      });
      setFromAi(true);
    } catch {
      if (skipped.current) return;
      setDraft({ ...EMPTY, description: trimmed });
      setAiFailed(true);
    }
    setStage("edit");
  }

  function skipReading() {
    skipped.current = true;
    setDraft({ ...EMPTY, description: text.trim() });
    setStage("edit");
  }

  function addSkill() {
    const skill = skillInput.trim().replace(/,+$/, "").trim();
    setSkillInput("");
    if (!skill || draft.skills.length >= MAX_SKILLS) return;
    if (draft.skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) return;
    set("skills", [...draft.skills, skill]);
  }

  const errors = validate(draft);
  const shown = (key: ErrorKey) => (attempted || touched[key] ? errors[key] : undefined);
  const touch = (key: ErrorKey) => setTouched((current) => ({ ...current, [key]: true }));
  const control = (id: string, key: ErrorKey) => ({
    id,
    "aria-invalid": shown(key) ? true : undefined,
    "aria-describedby": shown(key) ? `${id}-error` : undefined,
    onBlur: () => touch(key),
  });

  async function publish() {
    setAttempted(true);
    const firstError = (Object.keys(errors) as ErrorKey[])[0];
    if (firstError) {
      document.getElementById(`help-${firstError}`)?.focus();
      return;
    }
    if (publishing || !draft.rewardType) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const request = await createHelpRequest({
        title: draft.title.trim(),
        description: draft.description.trim(),
        requesterName: draft.requesterName.trim(),
        department: draft.department.trim(),
        buildingId: draft.buildingId,
        timeNeeded: draft.timeNeeded.trim(),
        skills: draft.skills,
        rewardType: draft.rewardType,
        rewardDetail: draft.rewardDetail.trim(),
        spots: draft.spots,
      });
      setCreated(request);
      setStage("done");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Could not publish. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  if (stage === "done" && created) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-6" aria-hidden />
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight text-balance outline-none"
        >
          Request posted
        </h1>
        <p className="text-sm text-pretty break-words text-muted-foreground">{created.title}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link href={`/help/${created.id}`} className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
            View request
          </Link>
          <Link
            href="/help/mine"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
          >
            My requests
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "write" || stage === "reading") {
    const reading = stage === "reading";
    return (
      <div className="mx-auto max-w-2xl px-6 pt-12 pb-16 sm:pt-16">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          <label htmlFor="help-text">What do you need help with?</label>
        </h1>

        <form
          className="mt-7 rounded-2xl border bg-card p-2 shadow-sm transition-shadow focus-within:border-ring focus-within:shadow-md motion-reduce:transition-none"
          onSubmit={(event) => {
            event.preventDefault();
            readRequest();
          }}
        >
          <textarea
            id="help-text"
            rows={6}
            maxLength={2000}
            readOnly={reading}
            placeholder="In your own words, like: I need two students to help set up posters for our research day on Friday afternoon…"
            className="block min-h-40 w-full resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground read-only:text-muted-foreground"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="flex items-center justify-end gap-2 px-1 pb-1">
            <Button type="submit" size="lg" className="h-10 px-4" disabled={reading || !text.trim()}>
              {reading ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              {reading ? "Reading" : "Continue"}
              {!reading && <ArrowRight aria-hidden />}
            </Button>
          </div>
        </form>

        <div role="status" aria-live="polite">
          {reading && (
            <div className="mt-6 rounded-2xl bg-secondary p-4">
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="size-4 text-primary" aria-hidden />
                Reading your request
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Up to 30 seconds. Keep this page open.</p>
              <div className="mt-4 space-y-2" aria-hidden>
                <Skeleton className="h-4 w-2/3 bg-primary/15 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-full bg-primary/15 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-1/2 bg-primary/15 motion-reduce:animate-none" />
              </div>
            </div>
          )}
        </div>
        {reading && (
          <div className="mt-3 text-center">
            <Button type="button" variant="ghost" onClick={skipReading}>
              Skip, fill it in myself
            </Button>
          </div>
        )}
      </div>
    );
  }

  const rewardError = shown("rewardType");

  return (
    <div className="mx-auto max-w-2xl px-6 pt-8 pb-16">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        Check your request
      </h1>

      {fromAi && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-secondary px-3.5 py-2.5 text-sm text-pretty">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-medium">AI draft.</span> Check every field before you publish.
          </span>
        </p>
      )}
      {aiFailed && (
        <p role="status" className="mt-4 rounded-xl bg-secondary px-3.5 py-2.5 text-sm text-pretty">
          We could not read your request. Fill in the form yourself.
        </p>
      )}

      <form
        noValidate
        className="mt-6 grid gap-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          publish();
        }}
      >
        <FormField id="help-title" label="Title" error={shown("title")} className="sm:col-span-2">
          <Input
            {...control("help-title", "title")}
            className="h-10"
            maxLength={120}
            autoComplete="off"
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
          />
        </FormField>

        <FormField
          id="help-description"
          label="Description"
          error={shown("description")}
          className="sm:col-span-2"
        >
          <Textarea
            {...control("help-description", "description")}
            className="min-h-28"
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </FormField>

        <FormField id="help-requesterName" label="Your name" error={shown("requesterName")}>
          <Input
            {...control("help-requesterName", "requesterName")}
            className="h-10"
            autoComplete="name"
            value={draft.requesterName}
            onChange={(event) => set("requesterName", event.target.value)}
          />
        </FormField>

        <FormField id="help-department" label="Department" error={shown("department")}>
          <Input
            {...control("help-department", "department")}
            className="h-10"
            autoComplete="organization"
            value={draft.department}
            onChange={(event) => set("department", event.target.value)}
          />
        </FormField>

        <FormField id="help-timeNeeded" label="Time needed" error={shown("timeNeeded")}>
          <Input
            {...control("help-timeNeeded", "timeNeeded")}
            className="h-10"
            placeholder="2 hours, one afternoon"
            autoComplete="off"
            value={draft.timeNeeded}
            onChange={(event) => set("timeNeeded", event.target.value)}
          />
        </FormField>

        <FormField id="help-spots" label="Spots">
          <Select
            value={String(draft.spots)}
            onValueChange={(value) => set("spots", Number(value ?? 1))}
          >
            <SelectTrigger id="help-spots" className="w-full data-[size=default]:h-10">
              <SelectValue>
                {draft.spots} {draft.spots === 1 ? "student" : "students"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SPOTS.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField id="help-building" label="Building" optional className="sm:col-span-2">
          <Select
            value={draft.buildingId ?? NO_BUILDING}
            onValueChange={(value) =>
              set("buildingId", !value || value === NO_BUILDING ? null : value)
            }
          >
            <SelectTrigger id="help-building" className="w-full data-[size=default]:h-10">
              <SelectValue>
                {buildings.find((building) => building.id === draft.buildingId)?.name ?? (
                  <span className="text-muted-foreground">No building</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BUILDING}>No building</SelectItem>
              {buildings.map((building) => (
                <SelectItem key={building.id} value={building.id}>
                  {building.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField id="help-skill" label="Skills" optional className="sm:col-span-2">
          {draft.skills.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {draft.skills.map((skill) => (
                <li
                  key={skill}
                  className="flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-sm"
                >
                  {skill}
                  <button
                    type="button"
                    aria-label={`Remove ${skill}`}
                    onClick={() =>
                      set(
                        "skills",
                        draft.skills.filter((existing) => existing !== skill),
                      )
                    }
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draft.skills.length < MAX_SKILLS && (
            <div className="flex gap-2">
              <Input
                id="help-skill"
                className="h-10"
                placeholder="Add a skill"
                autoComplete="off"
                maxLength={40}
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addSkill();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 px-3"
                disabled={!skillInput.trim()}
                onClick={addSkill}
              >
                <Plus aria-hidden />
                Add
              </Button>
            </div>
          )}
        </FormField>

        <fieldset
          className={cn(
            "min-w-0 rounded-xl border p-4 sm:col-span-2",
            rewardError && "border-destructive",
          )}
        >
          <legend className="px-1 text-sm font-medium">What does the student get?</legend>
          <p className="text-xs text-muted-foreground">
            Students should get something for their time.
          </p>
          <div
            role="radiogroup"
            aria-label="What the student gets"
            aria-describedby={rewardError ? "help-rewardType-error" : undefined}
            className="mt-3 flex flex-wrap gap-2"
          >
            {REWARD_TYPES.map((reward, index) => {
              const selected = draft.rewardType === reward;
              return (
                <button
                  key={reward}
                  id={index === 0 ? "help-rewardType" : undefined}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    set("rewardType", reward);
                    touch("rewardType");
                  }}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
                    selected
                      ? "border-accent bg-accent text-accent-foreground"
                      : "bg-background hover:bg-secondary",
                  )}
                >
                  {selected && <Check className="size-3.5" aria-hidden />}
                  {label(reward)}
                </button>
              );
            })}
          </div>
          {rewardError && (
            <div className="mt-2">
              <FieldError id="help-rewardType-error" message={rewardError} />
            </div>
          )}

          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex min-h-5 items-center gap-2">
              <Label htmlFor="help-rewardDetail">Details</Label>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <Input
              id="help-rewardDetail"
              className="h-10"
              placeholder="1 unit of independent study"
              autoComplete="off"
              value={draft.rewardDetail}
              onChange={(event) => set("rewardDetail", event.target.value)}
            />
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 sm:col-span-2">
          {publishError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {publishError}
            </p>
          )}
          <Button type="submit" size="lg" className="h-11 w-full sm:w-fit sm:px-6" disabled={publishing}>
            {publishing && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {publishing ? "Publishing" : "Publish request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
