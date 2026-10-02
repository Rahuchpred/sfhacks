"use client";

// Design reference (Mobbin, web): Shopify "Scan to pick" (Not verified and Verified lists
// beside one verify action) and Mercor "Enter verification code" (one large code field).

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleCheck, Hourglass, KeyRound, LoaderCircle, TriangleAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmPickup, listRescueClaims } from "@/lib/db";
import type { FoodRescue, RescueClaim } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  GOLD_BUTTON,
  PICKUP_CODE_LENGTH,
  formatHold,
  normalizePickupCode,
} from "./food-utils";
import { formatClock } from "./host-utils";

type Banner =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; name: string }
  | { kind: "already"; name: string }
  | { kind: "not_found"; code: string }
  | { kind: "not_host" }
  | { kind: "error" };

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined") navigator.vibrate?.(pattern);
  } catch {
    // Not supported or not allowed. The banner already says what happened.
  }
}

const TONE = {
  quiet: "border-dashed border-border bg-transparent text-muted-foreground",
  ok: "border-accent bg-accent text-accent-foreground",
  warn: "border-accent/40 bg-accent/15 text-foreground",
  bad: "border-destructive/40 bg-destructive/10 text-foreground",
};

function ResultBanner({ banner, attempt }: { banner: Banner; attempt: number }) {
  const tone =
    banner.kind === "idle" || banner.kind === "checking"
      ? TONE.quiet
      : banner.kind === "ok"
        ? TONE.ok
        : banner.kind === "already"
          ? TONE.warn
          : TONE.bad;
  const settled = banner.kind !== "idle" && banner.kind !== "checking";

  return (
    // Fixed minimum height, so results do not push the code box around under the thumb.
    <div role="status" aria-live="assertive" aria-atomic="true" className="min-h-24">
      <div
        // A new key for each answer replays the entrance, so two results in a row both read as new.
        key={settled ? attempt : banner.kind}
        className={cn(
          "flex min-h-24 items-center gap-3 rounded-2xl border p-4",
          tone,
          settled && "animate-in fade-in-0 zoom-in-[0.97] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none",
        )}
      >
        {banner.kind === "idle" && (
          <>
            <KeyRound aria-hidden className="size-6 shrink-0" />
            <p className="text-sm text-pretty">Type the code on the student&apos;s phone.</p>
          </>
        )}
        {banner.kind === "checking" && (
          <>
            <LoaderCircle aria-hidden className="size-6 shrink-0 animate-spin motion-reduce:animate-none" />
            <p className="text-base font-medium">Checking</p>
          </>
        )}
        {banner.kind === "ok" && (
          <>
            <CircleCheck aria-hidden className="size-10 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Picked up</p>
              <p className="text-2xl leading-tight font-semibold text-balance break-words">{banner.name}</p>
            </div>
          </>
        )}
        {banner.kind === "already" && (
          <>
            <TriangleAlert aria-hidden className="size-10 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Already picked up</p>
              <p className="text-2xl leading-tight font-semibold text-balance break-words">{banner.name}</p>
            </div>
          </>
        )}
        {banner.kind === "not_found" && (
          <>
            <XCircle aria-hidden className="size-10 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-lg leading-tight font-semibold">
                No hold with code <span className="font-mono tracking-widest">{banner.code}</span>
              </p>
              <p className="mt-1 text-sm text-pretty">It may have run out. Check the code and try again.</p>
            </div>
          </>
        )}
        {banner.kind === "not_host" && (
          <>
            <XCircle aria-hidden className="size-10 shrink-0 text-destructive" />
            <p className="min-w-0 text-lg leading-tight font-semibold text-pretty">
              You cannot confirm pickups for this food.
            </p>
          </>
        )}
        {banner.kind === "error" && (
          <>
            <XCircle aria-hidden className="size-10 shrink-0 text-destructive" />
            <p className="min-w-0 text-lg leading-tight font-semibold text-pretty">
              Could not confirm. Check your connection and try again.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/60 px-2 py-2.5 text-center">
      <dd className={cn("text-2xl leading-none font-semibold tabular-nums", strong && "text-accent")}>
        {value}
      </dd>
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

const STATUS: Record<FoodRescue["status"], string> = {
  open: "Open",
  gone: "All claimed",
  expired: "Ended",
};

type ClaimsState =
  | { status: "loading"; claims: RescueClaim[] }
  | { status: "ready"; claims: RescueClaim[] }
  | { status: "error"; claims: RescueClaim[] };

export function FoodPickups({
  rescue,
  tick,
  now,
  onConfirmed,
}: {
  rescue: FoodRescue;
  tick: number; // bumps on every live change and every 15 seconds
  now: number;
  onConfirmed: () => void;
}) {
  const [state, setState] = useState<ClaimsState>({ status: "loading", claims: [] });
  const [banner, setBanner] = useState<Banner>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const titleId = useId();

  const loadClaims = useCallback(async () => {
    try {
      const claims = await listRescueClaims(rescue.id);
      setState({ status: "ready", claims });
    } catch {
      // Keep the last good list on screen if a background refresh fails.
      setState((current) =>
        current.status === "ready" ? current : { status: "error", claims: [] },
      );
    }
  }, [rescue.id]);

  useEffect(() => {
    let cancelled = false;
    listRescueClaims(rescue.id)
      .then((claims) => {
        if (!cancelled) setState({ status: "ready", claims });
      })
      .catch(() => {
        if (cancelled) return;
        setState((current) =>
          current.status === "ready" ? current : { status: "error", claims: [] },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [rescue.id, rescue.portionsLeft, tick]);

  async function submit(rawCode: string) {
    if (busyRef.current) return;
    const code = normalizePickupCode(rawCode);
    if (code.length !== PICKUP_CODE_LENGTH) {
      inputRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setBanner({ kind: "checking" });
    try {
      const result = await confirmPickup(rescue.id, code);
      const name = result.guestName?.trim() || "Guest";
      if (result.ok) {
        setBanner({ kind: "ok", name });
        vibrate(80);
        void loadClaims();
        onConfirmed();
      } else {
        setBanner(
          result.reason === "already_picked_up"
            ? { kind: "already", name }
            : result.reason === "not_host"
              ? { kind: "not_host" }
              : { kind: "not_found", code },
        );
        vibrate([60, 60, 60]);
      }
    } catch {
      setBanner({ kind: "error" });
      vibrate([60, 60, 60]);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setAttempt((current) => current + 1);
      // Ready for the next student in line.
      setTyped("");
      inputRef.current?.focus();
    }
  }

  const holds = state.claims.filter(
    (claim) => !claim.pickedUpAt && Date.parse(claim.expiresAt) > now,
  );
  // A hold that just ran out is free again, a few seconds before the database says so.
  const ranOut = state.claims.length - holds.length - state.claims.filter((claim) => claim.pickedUpAt).length;
  const left = Math.min(rescue.portions, rescue.portionsLeft + ranOut);
  const pickedUp = state.claims
    .filter((claim) => claim.pickedUpAt)
    .sort((a, b) => Date.parse(b.pickedUpAt ?? "") - Date.parse(a.pickedUpAt ?? ""));
  const safeClock = formatClock(rescue.safeUntil);

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
    >
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rescue.photoUrl}
          alt=""
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-xl bg-muted object-cover"
        />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg leading-tight font-semibold text-balance break-words">
            {rescue.items}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {safeClock && `Safe until ${safeClock} · `}
            {rescue.maxPerPerson} per student
          </p>
        </div>
        <Badge
          variant={rescue.status === "open" ? "default" : "secondary"}
          className={cn("shrink-0", rescue.status === "open" && "bg-accent text-accent-foreground")}
        >
          {STATUS[rescue.status]}
        </Badge>
      </header>

      <dl className="grid grid-cols-4 gap-2" aria-live="polite">
        <Stat label="Posted" value={rescue.portions} />
        <Stat label="Left" value={left} strong />
        <Stat label="Held" value={holds.length} />
        <Stat label="Picked up" value={pickedUp.length} />
      </dl>

      <form
        noValidate
        onSubmit={(formEvent) => {
          formEvent.preventDefault();
          void submit(typed);
        }}
        className="flex flex-col gap-2"
      >
        <Label htmlFor={inputId}>Pickup code</Label>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            id={inputId}
            name="pickup-code"
            type="text"
            inputMode="text"
            enterKeyHint="done"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            // Room for pasted spaces and dashes. They are stripped as you type.
            maxLength={12}
            placeholder="A1B2"
            value={typed}
            onChange={(changeEvent) => {
              const code = normalizePickupCode(changeEvent.target.value);
              setTyped(code);
              // The fourth character sends it: no extra tap with a line waiting.
              if (code.length === PICKUP_CODE_LENGTH) void submit(code);
            }}
            className="h-14 min-w-0 flex-1 text-center font-mono text-2xl font-semibold tracking-[0.4em] placeholder:font-normal placeholder:text-muted-foreground/50 md:text-2xl"
          />
          <Button
            type="submit"
            disabled={busy || typed.length !== PICKUP_CODE_LENGTH}
            className={cn(GOLD_BUTTON, "h-14 shrink-0 touch-manipulation px-5 text-base")}
          >
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            Confirm
          </Button>
        </div>
      </form>

      <ResultBanner banner={banner} attempt={attempt} />

      {state.status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <p role="status" className="sr-only">
            Loading holds
          </p>
          <Skeleton className="h-12 w-full motion-reduce:animate-none" />
          <Skeleton className="h-12 w-full motion-reduce:animate-none" />
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-medium text-destructive">Could not load the holds.</p>
          <Button
            type="button"
            variant="outline"
            className="h-10 touch-manipulation px-4"
            onClick={() => {
              setState({ status: "loading", claims: [] });
              void loadClaims();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Holding ({holds.length})</h3>
            {holds.length === 0 ? (
              <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">
                No holds right now.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {holds.map((claim) => {
                  const remaining = Date.parse(claim.expiresAt) - now;
                  return (
                    <li
                      key={claim.claimId}
                      className="flex min-h-12 items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
                    >
                      <Hourglass aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-base font-medium">
                        {claim.guestName}
                      </span>
                      <time
                        dateTime={claim.expiresAt}
                        aria-label={`${formatHold(remaining)} left`}
                        className={cn(
                          "shrink-0 font-mono text-base tabular-nums",
                          remaining < 2 * 60_000 && "font-semibold text-destructive",
                        )}
                      >
                        {formatHold(remaining)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Picked up ({pickedUp.length})</h3>
            {pickedUp.length === 0 ? (
              <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">
                Nobody yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {pickedUp.map((claim) => (
                  <li
                    key={claim.claimId}
                    className="flex min-h-12 items-center gap-2 rounded-xl bg-accent/10 px-3 py-2"
                  >
                    <CircleCheck aria-hidden className="size-4 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate text-base font-medium">
                      {claim.guestName}
                    </span>
                    <time
                      dateTime={claim.pickedUpAt ?? undefined}
                      className="shrink-0 text-sm text-muted-foreground tabular-nums"
                    >
                      {claim.pickedUpAt ? formatClock(claim.pickedUpAt) : ""}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
