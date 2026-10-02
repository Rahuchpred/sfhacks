"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRescue } from "@/lib/db";
import type {
  Building,
  EstimateFoodRequest,
  EstimateFoodResponse,
  FoodRescue,
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

type Values = {
  items: string;
  portions: string;
  maxPerPerson: string;
  dietary: string; // comma separated
  safeUntil: string; // datetime-local value
  buildingId: string;
  room: string;
};
type FieldKey = keyof Values;
type Errors = Partial<Record<FieldKey, string>>;

const EMPTY: Values = {
  items: "",
  portions: "",
  maxPerPerson: "1",
  dietary: "",
  safeUntil: "",
  buildingId: "",
  room: "",
};

const GOLD_BUTTON = "h-10 bg-accent px-4 text-accent-foreground hover:bg-accent/85";

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.items.trim()) errors.items = "Say what the food is.";
  const portions = Number(values.portions);
  if (!Number.isInteger(portions) || portions < 1) {
    errors.portions = "Enter a whole number of portions, at least 1.";
  }
  const maxPerPerson = Number(values.maxPerPerson);
  if (!Number.isInteger(maxPerPerson) || maxPerPerson < 1 || maxPerPerson > 10) {
    errors.maxPerPerson = "Enter a whole number from 1 to 10.";
  }
  const safeUntil = fromLocalInput(values.safeUntil);
  if (!safeUntil) errors.safeUntil = "Set the time the food is safe until.";
  else if (Date.parse(safeUntil) <= Date.now()) {
    errors.safeUntil = "This time has already passed. Set a later one.";
  }
  if (!values.buildingId) errors.buildingId = "Pick the building where the food is.";
  return errors;
}

export function FoodForm({ buildings }: { buildings: Building[] }) {
  const router = useRouter();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateFoodResponse | null>(null);
  const estimateId = useRef(0);

  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState<FoodRescue | null>(null);

  useLeaveWarning(!published && photoUrl !== null);

  async function runEstimate(imageUrl: string) {
    const id = ++estimateId.current;
    setEstimating(true);
    setEstimateError(null);
    try {
      const result = await postJson<EstimateFoodRequest, EstimateFoodResponse>(
        "/api/ai/estimate-food",
        { imageUrl, postedAt: new Date().toISOString() },
      );
      if (id !== estimateId.current) return;
      setEstimate(result);
      setErrors({});
      // The place is the poster's to fill in: keep what they already chose.
      setValues((current) => ({
        ...current,
        items: result.items,
        portions: String(result.portions),
        dietary: result.dietary.join(", "),
        safeUntil: toLocalInput(result.safeUntil),
      }));
    } catch (error) {
      if (id !== estimateId.current) return;
      setEstimateError(errorMessage(error, "Could not estimate from the photo."));
    } finally {
      if (id === estimateId.current) setEstimating(false);
    }
  }

  function handlePhoto(url: string | null) {
    setPhotoUrl(url);
    if (url) {
      runEstimate(url);
    } else {
      estimateId.current++;
      setEstimating(false);
      setEstimate(null);
      setEstimateError(null);
    }
  }

  function update(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!photoUrl || publishing) return;

    const found = validate(values);
    setErrors(found);
    const first = (Object.keys(found) as FieldKey[])[0];
    if (first) {
      document.getElementById(`food-${first}`)?.focus();
      return;
    }
    const safeUntil = fromLocalInput(values.safeUntil);
    if (!safeUntil) return;

    setPublishing(true);
    setPublishError(null);
    try {
      const created = await createRescue({
        eventId: null,
        buildingId: values.buildingId,
        room: values.room.trim() || null,
        photoUrl,
        items: values.items.trim(),
        portions: Number(values.portions),
        maxPerPerson: Number(values.maxPerPerson),
        dietary: parseTags(values.dietary),
        safeUntil,
      });
      setPublished(created);
      toast.success("Leftover food posted", {
        description: "Students can claim a portion now.",
        action: { label: "View free food", onClick: () => router.push("/food") },
      });
    } catch (error) {
      setPublishError(errorMessage(error, "Could not post. Try again."));
    } finally {
      setPublishing(false);
    }
  }

  function reset() {
    estimateId.current++;
    setPhotoUrl(null);
    setEstimating(false);
    setEstimate(null);
    setEstimateError(null);
    setValues(EMPTY);
    setErrors({});
    setPublishError(null);
    setPublished(null);
  }

  if (published) {
    const building = buildings.find((item) => item.id === published.buildingId);
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-6 py-10 text-center">
        <CircleCheck className="size-10 text-accent" aria-hidden />
        <h2 className="text-lg font-semibold text-balance">Your food is on the list</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {published.portions} {published.portions === 1 ? "portion" : "portions"} of{" "}
          {published.items}
          {building ? ` at ${building.name}` : ""}. Thanks for keeping it out of the trash.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href="/food" className={cn(buttonVariants({ size: "lg" }), GOLD_BUTTON)}>
            See it on Free food
          </Link>
          <Button variant="outline" size="lg" className="h-10 px-4" onClick={reset}>
            Post more food
          </Button>
        </div>
      </div>
    );
  }

  const issues = (key: FieldKey) =>
    errors[key] ? [{ message: errors[key], severity: "error" as const }] : [];
  const showForm = photoUrl !== null && !estimating;

  return (
    <form onSubmit={publish} className="flex flex-col gap-8" noValidate>
      <section aria-labelledby="food-source" className="flex flex-col gap-4">
        <div>
          <h2 id="food-source" className="text-base font-semibold">
            1. Take a photo of the food
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            AI estimates what it is, how many portions are left and how long it stays safe. You
            confirm every value before anything is posted.
          </p>
        </div>

        <ImageDrop
          label="Add a photo of the food"
          value={photoUrl}
          onChange={handlePhoto}
          onUploadingChange={setUploading}
          tone="food"
          disabled={publishing}
        />

        <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          {estimating && (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Estimating from your photo. This can take up to half a minute…
            </>
          )}
        </p>

        {estimateError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
            <p className="font-medium text-destructive">
              {estimateError} You can fill in the details yourself.
            </p>
            {photoUrl && (
              <Button type="button" variant="outline" onClick={() => runEstimate(photoUrl)}>
                Try the estimate again
              </Button>
            )}
          </div>
        )}
      </section>

      {showForm && (
        <section aria-labelledby="food-details" className="flex flex-col gap-4">
          <h2 id="food-details" className="text-base font-semibold">
            2. Confirm the details
          </h2>

          {estimate && (
            <p className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-pretty">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-medium">These values are an AI estimate from your photo.</span>{" "}
                You know the food better than a photo does: correct anything that is off,
                especially allergens and the safe-until time.
              </span>
            </p>
          )}

          <fieldset disabled={publishing} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field
              id="food-items"
              label="What is it"
              issues={issues("items")}
              className="sm:col-span-2"
            >
              <Input
                {...fieldControlProps("food-items", issues("items"))}
                name="items"
                autoComplete="off"
                value={values.items}
                onChange={(event) => update("items", event.target.value)}
              />
            </Field>

            <Field id="food-portions" label="Portions" issues={issues("portions")}>
              <Input
                {...fieldControlProps("food-portions", issues("portions"))}
                name="portions"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={values.portions}
                onChange={(event) => update("portions", event.target.value)}
              />
            </Field>

            <Field
              id="food-maxPerPerson"
              label="Limit per student"
              issues={issues("maxPerPerson")}
              hint="How many portions one student can take."
            >
              <Input
                {...fieldControlProps("food-maxPerPerson", issues("maxPerPerson"))}
                name="maxPerPerson"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                value={values.maxPerPerson}
                onChange={(event) => update("maxPerPerson", event.target.value)}
              />
            </Field>

            <Field
              id="food-safeUntil"
              label="Safe until"
              issues={issues("safeUntil")}
              hint={estimate?.note || undefined}
            >
              <Input
                {...fieldControlProps("food-safeUntil", issues("safeUntil"))}
                name="safeUntil"
                type="datetime-local"
                value={values.safeUntil}
                onChange={(event) => update("safeUntil", event.target.value)}
              />
            </Field>

            <Field
              id="food-dietary"
              label="Dietary tags"
              optional
              hint="Separate with commas, for example: vegetarian, contains nuts, halal."
              className="sm:col-span-2"
            >
              <Input
                {...fieldControlProps("food-dietary")}
                name="dietary"
                autoComplete="off"
                value={values.dietary}
                onChange={(event) => update("dietary", event.target.value)}
              />
            </Field>

            <Field id="food-buildingId" label="Building" issues={issues("buildingId")}>
              <select
                {...fieldControlProps("food-buildingId", issues("buildingId"))}
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

            <Field id="food-room" label="Room" optional>
              <Input
                {...fieldControlProps("food-room")}
                name="room"
                autoComplete="off"
                value={values.room}
                onChange={(event) => update("room", event.target.value)}
              />
            </Field>
          </fieldset>

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pretty text-muted-foreground">
              Students see these values exactly as you confirm them.
            </p>
            <Button
              type="submit"
              size="lg"
              className={cn(GOLD_BUTTON, "shrink-0")}
              disabled={publishing || uploading}
            >
              {publishing && (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {publishing ? "Posting…" : "Confirm and post food"}
            </Button>
          </div>

          {publishError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {publishError}
            </p>
          )}
        </section>
      )}
    </form>
  );
}
