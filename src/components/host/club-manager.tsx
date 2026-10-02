"use client";

// Mobbin reference: Vercel, team members (an invite card on top, the people it produced below).
import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/auth-provider";
import { Field, fieldControlProps } from "@/components/post/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createClub,
  getMyProfile,
  joinClub,
  listClubMembers,
  listMyClubs,
  saveMyProfile,
} from "@/lib/db";
import type { MyClub } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClubCard, type ClubRoster } from "./club-card";

const CODE_LENGTH = 6;
const NAME_MIN = 2;
const NAME_MAX = 80;
const FRESH_MS = 4000;
const PANEL = "rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10";
const PULSE = "motion-reduce:animate-none";

type Pending = "create" | "join" | null;
type Errors = { fullName?: string; clubName?: string; code?: string };

// Uppercases as typed and drops spaces, dashes and anything else a pasted code may carry.
export function cleanJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Check your connection and try again.";
}

function issue(message: string | undefined) {
  return message ? [{ message, severity: "error" as const }] : [];
}

export function ClubManager() {
  const user = useUser();
  const userId = user?.id ?? null;

  const [clubs, setClubs] = useState<MyClub[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [rosters, setRosters] = useState<Record<string, ClubRoster>>({});
  // Null until the profile has been read.
  const [needsName, setNeedsName] = useState<boolean | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [clubName, setClubName] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<Pending>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const clubNameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const freshTimer = useRef<number | null>(null);

  const loadRoster = useCallback(async (clubId: string) => {
    try {
      const members = await listClubMembers(clubId);
      setRosters((current) => ({ ...current, [clubId]: members }));
    } catch {
      // A failed refresh keeps a list that is already on screen.
      setRosters((current) =>
        Array.isArray(current[clubId]) ? current : { ...current, [clubId]: "error" },
      );
    }
  }, []);

  const load = useCallback(async () => {
    // Before anonymous sign-in finishes the list would come back empty.
    if (!userId) return;
    try {
      const [list, profile] = await Promise.all([listMyClubs(), getMyProfile()]);
      list.sort((a, b) => a.name.localeCompare(b.name));
      setClubs(list);
      setNeedsName(!profile?.fullName.trim());
      setLoadError(null);
      list.forEach((club) => void loadRoster(club.id));
    } catch (error) {
      setLoadError(messageOf(error));
    }
  }, [userId, loadRoster]);

  useEffect(() => {
    // An organizer who joined on another device shows up when this tab is looked at again.
    const onFocus = () => void load();
    onFocus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(
    () => () => {
      if (freshTimer.current !== null) window.clearTimeout(freshTimer.current);
    },
    [],
  );

  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };

  const markFresh = (clubId: string) => {
    setFreshId(clubId);
    if (freshTimer.current !== null) window.clearTimeout(freshTimer.current);
    freshTimer.current = window.setTimeout(() => setFreshId(null), FRESH_MS);
  };

  // Saves the organizer's name the first time, so the roster can show it.
  const ensureName = async (): Promise<boolean> => {
    if (!needsName) return true;
    const name = fullName.trim();
    if (!name) {
      setErrors((current) => ({ ...current, fullName: "Enter your name." }));
      nameRef.current?.focus();
      return false;
    }
    await saveMyProfile({ fullName: name });
    setNeedsName(false);
    return true;
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const name = clubName.trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      setErrors({
        clubName: name ? `Use ${NAME_MIN} to ${NAME_MAX} characters.` : "Enter a club name.",
      });
      clubNameRef.current?.focus();
      return;
    }
    setErrors({});
    setPending("create");
    try {
      if (!(await ensureName())) return;
      const club = await createClub(name);
      setClubName("");
      markFresh(club.id);
      await load();
      toast.success(`${club.name} created`);
    } catch (error) {
      toast.error(`Could not create the club. ${messageOf(error)}`);
    } finally {
      setPending(null);
    }
  };

  const submitJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (code.length !== CODE_LENGTH) {
      setErrors({ code: `Codes are ${CODE_LENGTH} characters.` });
      codeRef.current?.focus();
      return;
    }
    const mine = clubs?.find((club) => club.joinCode === code);
    if (mine) {
      setErrors({ code: `You are already in ${mine.name}.` });
      codeRef.current?.focus();
      return;
    }
    setErrors({});
    setPending("join");
    try {
      if (!(await ensureName())) return;
      const club = await joinClub(code);
      if (!club) {
        setErrors({ code: "No club has that code." });
        codeRef.current?.focus();
        return;
      }
      setCode("");
      markFresh(club.id);
      await load();
      toast.success(`You joined ${club.name}`);
    } catch (error) {
      toast.error(`Could not join. ${messageOf(error)}`);
    } finally {
      setPending(null);
    }
  };

  if (!clubs && loadError) {
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center"
      >
        <TriangleAlert aria-hidden="true" className="size-6 text-destructive" />
        <p className="text-base font-medium">Could not load your clubs.</p>
        <p className="text-sm text-pretty break-words text-muted-foreground">{loadError}</p>
        <Button variant="outline" className="h-10 px-4" disabled={retrying} onClick={retry}>
          {retrying ? "Loading…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (!clubs) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p role="status" className="sr-only">
          Loading your clubs…
        </p>
        <div className={cn(PANEL, "grid gap-5 p-4 sm:grid-cols-2 sm:p-5")}>
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className={cn("h-4 w-24", PULSE)} />
              <Skeleton className={cn("h-10 w-full rounded-lg", PULSE)} />
            </div>
          ))}
        </div>
        <Skeleton className={cn("h-44 w-full rounded-xl", PULSE)} />
      </div>
    );
  }

  // The club just created or joined leads the list, the rest stay in name order.
  const ordered = freshId
    ? [...clubs].sort((a, b) => Number(b.id === freshId) - Number(a.id === freshId))
    : clubs;

  return (
    <div className="space-y-6">
      <div className={cn(PANEL, "space-y-5 p-4 sm:p-5")}>
        {needsName && (
          <Field
            id="club-full-name"
            label="Your name"
            hint="Co-organizers see it in the club."
            issues={issue(errors.fullName)}
            className="sm:max-w-sm"
          >
            <Input
              {...fieldControlProps("club-full-name", issue(errors.fullName))}
              ref={nameRef}
              name="name"
              autoComplete="name"
              maxLength={80}
              className="h-10"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                setErrors((current) => ({ ...current, fullName: undefined }));
              }}
            />
          </Field>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <form noValidate onSubmit={submitCreate}>
            <Field id="club-name" label="Create a club" issues={issue(errors.clubName)}>
              <div className="flex gap-2">
                <Input
                  {...fieldControlProps("club-name", issue(errors.clubName))}
                  ref={clubNameRef}
                  name="club-name"
                  autoComplete="off"
                  placeholder="Club name"
                  maxLength={NAME_MAX}
                  className="h-10"
                  value={clubName}
                  onChange={(event) => {
                    setClubName(event.target.value);
                    setErrors((current) => ({ ...current, clubName: undefined }));
                  }}
                />
                <Button type="submit" className="h-10 px-4" disabled={pending !== null}>
                  {pending === "create" ? "Creating…" : "Create"}
                </Button>
              </div>
            </Field>
          </form>

          <form noValidate onSubmit={submitJoin}>
            <Field id="club-code" label="Join with a code" issues={issue(errors.code)}>
              <div className="flex gap-2">
                <Input
                  {...fieldControlProps("club-code", issue(errors.code))}
                  ref={codeRef}
                  name="club-code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="ABC123"
                  className="h-10 font-mono tracking-[0.2em] placeholder:tracking-[0.2em]"
                  value={code}
                  onChange={(event) => {
                    setCode(cleanJoinCode(event.target.value));
                    setErrors((current) => ({ ...current, code: undefined }));
                  }}
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-10 px-4"
                  disabled={pending !== null}
                >
                  {pending === "join" ? "Joining…" : "Join"}
                </Button>
              </div>
            </Field>
          </form>
        </div>
      </div>

      {loadError && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="min-w-0 text-pretty break-words">
            Could not refresh, so this list may be out of date. {loadError}
          </span>
        </p>
      )}

      {ordered.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Users aria-hidden="true" className="size-6 text-primary" />
          </div>
          <p className="text-base font-medium text-balance">No clubs yet</p>
          <p className="text-sm text-pretty text-muted-foreground">
            Share events and check-in with your co-organizers.
          </p>
        </div>
      ) : (
        <section aria-labelledby="my-clubs-heading" className="space-y-3">
          <h2 id="my-clubs-heading" className="sr-only">
            Your clubs
          </h2>
          <ul className="space-y-3">
            {ordered.map((club) => (
              <li key={club.id} className="min-w-0">
                <ClubCard
                  club={club}
                  roster={rosters[club.id] ?? null}
                  myId={userId}
                  fresh={club.id === freshId}
                  onRetryRoster={() => {
                    setRosters((current) => ({ ...current, [club.id]: null }));
                    void loadRoster(club.id);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
