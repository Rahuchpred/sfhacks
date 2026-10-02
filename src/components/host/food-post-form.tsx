"use client";

// Design reference (Mobbin, web): Square "Create item" with its generated description
// panel (AI text lands in an editable field with a "review before saving" note), and
// Higgsfield "Create Product" (photo on the left, fields on the right).

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Minus, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, fieldControlProps } from "@/components/post/field";
import { ImageDrop } from "@/components/post/image-drop";
import { createRescue } from "@/lib/db";
import type {
  CampusEvent,
  EstimateFoodRequest,
  EstimateFoodResponse,
  FoodRescue,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DIETARY_OPTIONS,
  GOLD_BUTTON,
  LIMIT_OPTIONS,
  cleanTags,
  errorMessage,
  postJson,
  safeTimeOptions,
  snapToOption,
  type TimeOption,
} from "./food-utils";

type Values = {
  items: string;
  portions: string; // digits only, so the box can be empty while typing
  maxPerPerson: number;
  dietary: string[];
  safeUntil: string; // ISO, one of the time options
};
type ErrorKey = "items" | "portions" | "safeUntil";
type Errors = Partial<Record<ErrorKey, string>>;

const EMPTY: Values = { items: "", portions: "1", maxPerPerson: 1, dietary: [], safeUntil: "" };
const MAX_PORTIONS = 500;

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.items.trim()) errors.items = "Say what the food is.";
  const portions = Number(values.portions);
  if (!Number.isInteger(portions) || portions < 1) errors.portions = "At least 1 portion.";
  if (!values.safeUntil) errors.safeUntil = "Pick a time.";
  else if (Date.parse(values.safeUntil) <= Date.now()) errors.safeUntil = "That time has passed.";
  return errors;
}

const CONTROL = "h-11 text-base md:text-base";

export function FoodPostForm({
  event,
  place,
  onPublished,
  onCancel,
}: {
  event: CampusEvent;
  place: string;
  onPublished: (rescue: FoodRescue) => void;
  onCancel?: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<EstimateFoodResponse | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  // Bumped for every photo, so a slow answer for an old photo is dropped.
  const estimateId = useRef(0);

  const [values, setValues] = useState<Values>(EMPTY);
  const [times, setTimes] = useState<TimeOption[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    const ref = estimateId;
    return () => {
      ref.current++; // leaving the page drops any answer still on its way
    };
  }, []);

  // Runs once for each photo, by itself. Never from a button.
  async function runEstimate(imageUrl: string) {
    const id = ++estimateId.current;
    const options = safeTimeOptions(Date.now());
    setTimes(options);
    setEstimating(true);
    setEstimate(null);
    setEstimateError(null);
    setErrors({});
    try {
      const result = await postJson<EstimateFoodRequest, EstimateFoodResponse>(
        "/api/ai/estimate-food",
        { imageUrl, postedAt: new Date().toISOString() },
      );
      if (id !== estimateId.current) return;
      // The wait can cross a quarter hour, so the list is rebuilt for the time it lands.
      const fresh = safeTimeOptions(Date.now());
      setTimes(fresh);
      setEstimate(result);
      setValues((current) => ({
        ...current,
        items: result.items,
        portions: String(Math.min(MAX_PORTIONS, Math.max(1, Math.round(result.portions)))),
        dietary: cleanTags(result.dietary),
        safeUntil: snapToOption(result.safeUntil, fresh),
      }));
    } catch (error) {
      if (id !== estimateId.current) return;
      setEstimateError(errorMessage(error, "Could not read the photo."));
    } finally {
      if (id === estimateId.current) setEstimating(false);
    }
  }

  function handlePhoto(url: string | null) {
    setPhotoUrl(url);
    setPublishError(null);
    if (url) {
      void runEstimate(url);
    } else {
      estimateId.current++;
      setEstimating(false);
      setEstimate(null);
      setEstimateError(null);
      setValues(EMPTY);
      setErrors({});
    }
  }

  function update<Key extends keyof Values>(key: Key, value: Values[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function stepPortions(delta: number) {
    const current = Number(values.portions) || 0;
    update("portions", String(Math.min(MAX_PORTIONS, Math.max(1, current + delta))));
  }

  function toggleTag(tag: string) {
    update(
      "dietary",
      values.dietary.includes(tag)
        ? values.dietary.filter((item) => item !== tag)
        : [...values.dietary, tag],
    );
  }

  async function publish(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (!photoUrl || publishing || estimating) return;

    const found = validate(values);
    setErrors(found);
    const first = (Object.keys(found) as ErrorKey[])[0];
    if (first) {
      document.getElementById(`food-${first}`)?.focus();
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      const created = await createRescue({
        eventId: event.id,
        buildingId: event.buildingId,
        room: event.room,
        photoUrl,
        items: values.items.trim(),
        portions: Number(values.portions),
        maxPerPerson: values.maxPerPerson,
        dietary: values.dietary,
        safeUntil: values.safeUntil,
      });
      onPublished(created);
    } catch (error) {
      setPublishError(errorMessage(error, "Could not post. Try again."));
      setPublishing(false);
    }
  }

  const issues = (key: ErrorKey) =>
    errors[key] ? [{ message: errors[key], severity: "error" as const }] : [];
  // Tags the AI found that are not in the fixed list still get a chip.
  const tagChoices = [...new Set([...DIETARY_OPTIONS, ...values.dietary])];
  const selectedTime = times.find((option) => option.value === values.safeUntil);
  const showDraft = photoUrl !== null && !estimating;

  return (
    <form
      onSubmit={publish}
      noValidate
      className="grid gap-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-8"
    >
      <div className="flex flex-col gap-3">
        <ImageDrop
          label="Add a photo of the food"
          hint="Take a photo or choose one. JPEG, PNG or WebP."
          value={photoUrl}
          onChange={handlePhoto}
          onUploadingChange={setUploading}
          tone="food"
          square
          disabled={publishing}
        />
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{place}</span>
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {photoUrl === null && !uploading && (
          <div className="hidden flex-1 flex-col justify-center gap-1 rounded-xl border border-dashed p-5 text-sm text-muted-foreground md:flex">
            <p className="font-medium text-foreground">Start with a photo</p>
            <p className="text-pretty">The details fill in from it. You confirm them before posting.</p>
          </div>
        )}

        {(uploading || estimating) && (
          <div
            role="status"
            className="flex flex-col gap-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
          >
            <p className="flex items-center gap-2 text-base font-medium">
              <Loader2
                aria-hidden
                className="size-5 animate-spin text-accent motion-reduce:animate-none"
              />
              {uploading ? "Uploading your photo" : "Looking at your photo"}
            </p>
            <div aria-hidden className="flex flex-col gap-3">
              <Skeleton className="h-11 w-full motion-reduce:animate-none" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-11 motion-reduce:animate-none" />
                <Skeleton className="h-11 motion-reduce:animate-none" />
              </div>
              <Skeleton className="h-11 w-2/3 motion-reduce:animate-none" />
            </div>
            <p className="text-sm text-muted-foreground">Up to half a minute.</p>
          </div>
        )}

        {showDraft && (
          <div className="flex flex-col gap-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none">
            {estimate && (
              <p className="flex w-fit items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium">
                <Sparkles aria-hidden className="size-4 shrink-0 text-accent" />
                AI estimate. Check each value.
              </p>
            )}
            {estimateError && (
              <p role="alert" className="text-sm text-pretty">
                <span className="font-medium text-destructive">Could not read the photo.</span>{" "}
                Fill in the details yourself, or{" "}
                <button
                  type="button"
                  className="rounded-sm font-medium underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => void runEstimate(photoUrl)}
                >
                  try the photo again
                </button>
                .
              </p>
            )}

            <fieldset disabled={publishing} className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id="food-items" label="What is it" issues={issues("items")} className="sm:col-span-2">
                <Input
                  {...fieldControlProps("food-items", issues("items"))}
                  name="items"
                  autoComplete="off"
                  placeholder="Cheese pizza, 3 boxes"
                  value={values.items}
                  onChange={(changeEvent) => update("items", changeEvent.target.value)}
                  className={CONTROL}
                />
              </Field>

              <Field id="food-portions" label="Portions" issues={issues("portions")}>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="size-11 touch-manipulation"
                    aria-label="One portion fewer"
                    disabled={(Number(values.portions) || 0) <= 1}
                    onClick={() => stepPortions(-1)}
                  >
                    <Minus aria-hidden />
                  </Button>
                  <Input
                    {...fieldControlProps("food-portions", issues("portions"))}
                    name="portions"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={values.portions}
                    onChange={(changeEvent) => {
                      const digits = changeEvent.target.value.replace(/\D/g, "").slice(0, 3);
                      update("portions", digits ? String(Math.min(MAX_PORTIONS, Number(digits))) : "");
                    }}
                    className={cn(CONTROL, "min-w-0 flex-1 text-center font-medium tabular-nums")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="size-11 touch-manipulation"
                    aria-label="One portion more"
                    disabled={(Number(values.portions) || 0) >= MAX_PORTIONS}
                    onClick={() => stepPortions(1)}
                  >
                    <Plus aria-hidden />
                  </Button>
                </div>
              </Field>

              <Field id="food-maxPerPerson" label="Limit per student">
                <Select
                  value={String(values.maxPerPerson)}
                  onValueChange={(value) => update("maxPerPerson", Number(value) || 1)}
                >
                  <SelectTrigger id="food-maxPerPerson" className={cn(CONTROL, "w-full data-[size=default]:h-11")}>
                    <SelectValue>
                      {values.maxPerPerson} {values.maxPerPerson === 1 ? "portion" : "portions"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map((limit) => (
                      <SelectItem key={limit} value={String(limit)} className="min-h-9">
                        {limit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                id="food-safeUntil"
                label="Safe until"
                issues={issues("safeUntil")}
                hint={estimate?.note || undefined}
                className="sm:col-span-2"
              >
                <Select
                  value={values.safeUntil || null}
                  onValueChange={(value) => update("safeUntil", value ?? "")}
                >
                  <SelectTrigger
                    {...fieldControlProps("food-safeUntil", issues("safeUntil"))}
                    className={cn(CONTROL, "w-full data-[size=default]:h-11 sm:w-56")}
                  >
                    <SelectValue placeholder="Pick a time">
                      {selectedTime?.label ?? "Pick a time"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {times.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="min-h-9 tabular-nums">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                <div className="flex min-h-5 items-center gap-2">
                  <span id="food-dietary-label" className="text-sm leading-none font-medium">
                    Dietary tags
                  </span>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <div role="group" aria-labelledby="food-dietary-label" className="flex flex-wrap gap-2">
                  {tagChoices.map((tag) => {
                    const on = values.dietary.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "min-h-10 touch-manipulation rounded-full border px-3.5 text-sm font-medium outline-none transition-[background-color,border-color,scale] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100",
                          on
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            {publishError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {publishError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 touch-manipulation px-5 text-base"
                  disabled={publishing}
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                className={cn(GOLD_BUTTON, "h-12 touch-manipulation px-6 text-base")}
                disabled={publishing}
              >
                {publishing && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
                {publishing ? "Posting" : "Post food"}
              </Button>
            </div>
          </div>
        )}

        {!showDraft && onCancel && (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full touch-manipulation text-base sm:w-fit sm:self-end sm:px-5"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
