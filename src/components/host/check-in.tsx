"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheck,
  ListChecks,
  LoaderCircle,
  ScanLine,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkIn } from "@/lib/db";
import type { CampusEvent, CheckInResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckInList } from "./check-in-list";
import { HostGate } from "./host-states";
import { formatClock, formatEventTime } from "./host-utils";
import { Scanner } from "./scanner";
import { useHostEvent } from "./use-host-event";

const CODE_LENGTH = 8;
// A scanned code can be handled again once it has been out of frame this long.
const SAME_CODE_MS = 3000;

// Ticket codes are 8 uppercase hex characters. Drop spaces and dashes
// (including the long dashes phones swap in), then uppercase.
function normalizeCode(raw: string): string {
  return raw.replace(/[\s\-‐-―_]/g, "").toUpperCase();
}

type Banner =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; name: string; otherEvent: boolean }
  | { kind: "already"; name: string; at: string }
  | { kind: "not_found" }
  | { kind: "not_host" }
  | { kind: "error" };

function toBanner(result: CheckInResult, id: string): Banner {
  const name = result.guestName?.trim() || "Guest";
  if (result.ok) {
    return { kind: "ok", name, otherEvent: result.eventId !== null && result.eventId !== id };
  }
  if (result.reason === "already_checked_in") {
    return { kind: "already", name, at: result.checkedInAt ? formatClock(result.checkedInAt) : "" };
  }
  if (result.reason === "not_host") return { kind: "not_host" };
  return { kind: "not_found" };
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined") navigator.vibrate?.(pattern);
  } catch {
    // Not supported or not allowed. The banner already says what happened.
  }
}

const TONE = {
  quiet: "border-dashed border-border bg-transparent text-muted-foreground",
  ok: "border-primary bg-primary text-primary-foreground",
  warn: "border-accent/40 bg-accent/15 text-foreground",
  bad: "border-destructive/40 bg-destructive/10 text-foreground",
};

function ResultBanner({ banner }: { banner: Banner }) {
  const tone =
    banner.kind === "idle" || banner.kind === "checking"
      ? TONE.quiet
      : banner.kind === "ok"
        ? TONE.ok
        : banner.kind === "already"
          ? TONE.warn
          : TONE.bad;

  return (
    // Fixed minimum height, so results do not push the page around under the host's thumb.
    <div
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      className={cn("flex min-h-28 items-center gap-3 rounded-2xl border p-4", tone)}
    >
      {banner.kind === "idle" && (
        <>
          <ScanLine aria-hidden className="size-6 shrink-0" />
          <p className="text-sm text-pretty">Scan a ticket or type its code. The result shows here.</p>
        </>
      )}
      {banner.kind === "checking" && (
        <>
          <LoaderCircle aria-hidden className="size-6 shrink-0 animate-spin motion-reduce:animate-none" />
          <p className="text-base font-medium">Checking…</p>
        </>
      )}
      {banner.kind === "ok" && (
        <>
          <CircleCheck aria-hidden className="size-10 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary-foreground/80">Checked in</p>
            <p className="text-2xl leading-tight font-semibold text-balance break-words">{banner.name}</p>
            {banner.otherEvent && (
              <p className="mt-1 text-sm text-pretty">Checked in to a different event of yours.</p>
            )}
          </div>
        </>
      )}
      {banner.kind === "already" && (
        <>
          <TriangleAlert aria-hidden className="size-10 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Already checked in</p>
            <p className="text-2xl leading-tight font-semibold text-balance break-words">{banner.name}</p>
            {banner.at && <p className="mt-1 text-sm tabular-nums">at {banner.at}</p>}
          </div>
        </>
      )}
      {banner.kind === "not_found" && (
        <>
          <XCircle aria-hidden className="size-10 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-lg leading-tight font-semibold text-balance">No ticket with that code</p>
            <p className="mt-1 text-sm text-pretty">Check the code and try again.</p>
          </div>
        </>
      )}
      {banner.kind === "not_host" && (
        <>
          <XCircle aria-hidden className="size-10 shrink-0 text-destructive" />
          <p className="min-w-0 text-lg leading-tight font-semibold text-pretty">
            That ticket is for an event you do not host.
          </p>
        </>
      )}
      {banner.kind === "error" && (
        <>
          <XCircle aria-hidden className="size-10 shrink-0 text-destructive" />
          <p className="min-w-0 text-lg leading-tight font-semibold text-pretty">
            Could not check in. Check your connection and try again.
          </p>
        </>
      )}
    </div>
  );
}

function LiveBar({ checkedIn, going }: { checkedIn: number; going: number }) {
  const labelId = useId();
  const percent = going > 0 ? Math.min(100, Math.round((checkedIn / going) * 100)) : 0;

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <p id={labelId} className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
        <span className="text-3xl font-semibold text-foreground tabular-nums">{checkedIn}</span>
        checked in
        <span aria-hidden>/</span>
        <span className="sr-only">out of</span>
        <span className="text-3xl font-semibold text-foreground tabular-nums">{going}</span>
        going
      </p>
      <div
        role="progressbar"
        aria-label="Guests checked in"
        aria-valuemin={0}
        aria-valuemax={going}
        aria-valuenow={Math.min(checkedIn, going)}
        aria-valuetext={`${checkedIn} of ${going} checked in`}
        className="h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}

type View = "scan" | "list";

const VIEWS: { value: View; label: string; Icon: typeof ScanLine }[] = [
  { value: "scan", label: "Scan", Icon: ScanLine },
  { value: "list", label: "List", Icon: ListChecks },
];

function ViewSwitch({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div role="group" aria-label="Check-in view" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {VIEWS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full px-4 text-base font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
            view === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon aria-hidden className="size-5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function CheckInBody({ id, event, version }: { id: string; event: CampusEvent; version: number }) {
  const [view, setView] = useState<View>("scan");
  // Bumped on each check-in made here, so the list refetches without waiting for the live update.
  const [checkIns, setCheckIns] = useState(0);
  const [banner, setBanner] = useState<Banner>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  // Lowest count to show: covers the gap before the live count catches up.
  const [floor, setFloor] = useState(0);

  const busyRef = useRef(false);
  const lastScan = useRef<{ code: string; seenAt: number }>({ code: "", seenAt: 0 });
  const inputId = useId();
  const errorId = useId();

  const shownCount = Math.max(event.checkedInCount, floor);

  const submit = useCallback(
    async (rawCode: string, source: "scan" | "typed") => {
      if (busyRef.current) return;
      const code = normalizeCode(rawCode);

      // A QR code that is not a ticket (a link, a poster) never leaves the phone.
      if (source === "scan" && code.length !== CODE_LENGTH) {
        setBanner({ kind: "not_found" });
        vibrate([60, 60, 60]);
        return;
      }

      // Taken before the request: if the live count lands first, max() keeps it from counting twice.
      const countBefore = shownCount;
      busyRef.current = true;
      setBusy(true);
      setBanner({ kind: "checking" });
      try {
        const result = await checkIn(code);
        const next = toBanner(result, id);
        setBanner(next);
        if (next.kind === "ok") {
          setCheckIns((current) => current + 1);
          if (!next.otherEvent) setFloor((current) => Math.max(current, countBefore + 1));
          if (source === "typed") setTyped("");
          vibrate(80);
        } else {
          vibrate([60, 60, 60]);
        }
      } catch {
        setBanner({ kind: "error" });
        vibrate([60, 60, 60]);
        // Let the host hold the same ticket up again right away.
        if (source === "scan") lastScan.current = { code: "", seenAt: 0 };
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [id, shownCount],
  );

  // The scanner reports a code again and again while it stays in frame.
  const handleScan = useCallback(
    (raw: string) => {
      const code = normalizeCode(raw);
      if (!code) return;
      const now = Date.now();
      const last = lastScan.current;
      if (code === last.code && now - last.seenAt < SAME_CODE_MS) {
        last.seenAt = now; // still in frame
        return;
      }
      if (busyRef.current) return;
      lastScan.current = { code, seenAt: now };
      void submit(code, "scan");
    },
    [submit],
  );

  function handleTyped(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (busy) return;
    const code = normalizeCode(typed);
    if (code.length !== CODE_LENGTH) {
      setTypedError("Enter the 8-character code on the ticket.");
      return;
    }
    setTypedError(null);
    void submit(code, "typed");
  }

  const eventTime = formatEventTime(event);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-1">
        <Link
          href={`/host/${id}`}
          className="-ml-1 inline-flex min-h-10 w-fit touch-manipulation items-center gap-1.5 rounded-md px-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Manage event
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">{event.title}</h1>
        {eventTime && <p className="text-sm text-muted-foreground">{eventTime}</p>}
      </header>

      <ViewSwitch view={view} onChange={setView} />

      <ResultBanner banner={banner} />

      {/* Leaving the scan view unmounts the scanner, which turns the camera off. */}
      {view === "scan" ? (
        <Scanner onCode={handleScan} />
      ) : (
        <CheckInList eventId={id} version={version + checkIns} />
      )}

      <LiveBar checkedIn={shownCount} going={event.rsvpCount} />

      <form onSubmit={handleTyped} noValidate className="flex flex-col gap-2">
        <Label htmlFor={inputId}>Type the ticket code</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            name="code"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            // Room for pasted spaces and dashes. They are stripped as you type.
            maxLength={24}
            placeholder="A1B2C3D4"
            value={typed}
            onChange={(changeEvent) => {
              setTyped(normalizeCode(changeEvent.target.value).slice(0, CODE_LENGTH));
              setTypedError(null);
            }}
            aria-invalid={typedError ? true : undefined}
            aria-describedby={typedError ? errorId : undefined}
            className="h-12 min-w-0 flex-1 font-mono text-lg tracking-widest md:text-lg"
          />
          <Button
            type="submit"
            disabled={busy}
            className="h-12 shrink-0 touch-manipulation px-5 text-base"
          >
            Check in
          </Button>
        </div>
        {typedError && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {typedError}
          </p>
        )}
      </form>
    </div>
  );
}

export function CheckIn({ id }: { id: string }) {
  const { status, event, error, version } = useHostEvent(id);

  return (
    <HostGate status={status} error={error}>
      {event && <CheckInBody id={id} event={event} version={version} />}
    </HostGate>
  );
}
