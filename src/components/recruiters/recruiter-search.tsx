"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, BadgeCheck, Bookmark, BookmarkCheck, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { postJson } from "@/lib/api";
import { listRecruiterVisibleProfiles, listVisibleAttendance } from "@/lib/db";
import { cn } from "@/lib/utils";
import type {
  AttendedEvent,
  Profile,
  RecruiterMatch,
  RecruiterSearchResponse,
} from "@/lib/types";
import { VoiceButton } from "@/components/planner/voice-button";

const SEARCH_TIMEOUT_MS = 90_000;

// The route can pass the model's raw error through, a long block of JSON.
// The page shows one short line instead.
function searchMessage(error: unknown): string {
  const text = error instanceof Error ? error.message.trim() : "";
  if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(text)) {
    return "The AI is busy right now. Try again in a minute.";
  }
  if (!text || text.length > 140 || text.startsWith("{")) return "Search failed. Try again.";
  return text;
}

const EXAMPLES = [
  "machine learning workshops and hackathons",
  "active in cultural clubs",
  "shows up to career events",
  "volunteers on campus",
];

// Layout patterns borrowed from Mobbin references: a centered prompt box
// (Dropbox Dash), a "Popular" chip row (Dribbble), people rows with a context
// bubble on the right (Delphi) and a shortlist side panel (Semrush).

const AVATAR_COLORS = [
  "bg-[#463077] text-white",
  "bg-[#c99700] text-[#1b1530]",
  "bg-[#7a66ad] text-white",
  "bg-[#2d1f52] text-white",
  "bg-[#e6c25c] text-[#1b1530]",
];

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function avatarColor(id: string): string {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function Avatar({ profile, className }: { profile: Profile; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        avatarColor(profile.id),
        className,
      )}
    >
      {initials(profile.fullName)}
    </span>
  );
}

function subtitle(profile: Profile): string {
  return (
    [profile.major, profile.gradYear ? `Class of ${profile.gradYear}` : null]
      .filter(Boolean)
      .join(" · ") || "No major listed"
  );
}

type StudentRowProps = {
  profile: Profile;
  attended: AttendedEvent[];
  rank?: number;
  match?: RecruiterMatch;
  saved: boolean;
  onToggleSave: () => void;
};

function StudentRow({ profile, attended, rank, match, saved, onToggleSave }: StudentRowProps) {
  const evidence = new Set(match?.evidenceEventIds);
  // Evidence first, so the events that explain the match are never cut off.
  const events = [...attended].sort(
    (a, b) => Number(evidence.has(b.eventId)) - Number(evidence.has(a.eventId)),
  );
  const links = [
    profile.linkedinUrl && { label: "LinkedIn", href: profile.linkedinUrl },
    profile.githubUrl && { label: "GitHub", href: profile.githubUrl },
    profile.resumeUrl && { label: "Resume", href: profile.resumeUrl },
  ].filter((link): link is { label: string; href: string } => Boolean(link));
  const name = profile.fullName || "Unnamed student";

  return (
    <article className="flex gap-4 py-5">
      {rank !== undefined && (
        <span className="mt-3 w-4 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
          {rank}
        </span>
      )}
      <Avatar profile={profile} />

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{name}</span>
              {profile.sfsuVerified && (
                <BadgeCheck
                  className="size-4 shrink-0 text-primary"
                  aria-label="Verified SFSU student"
                />
              )}
            </h3>
            <p className="text-sm text-muted-foreground">{subtitle(profile)}</p>
          </div>

          {match ? (
            <p className="flex items-start gap-2 rounded-2xl rounded-tr-sm bg-secondary px-3.5 py-2.5 text-sm text-pretty lg:max-w-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="sr-only">Why this match, written by AI: </span>
                {match.reason}
              </span>
            </p>
          ) : (
            profile.aiSummary && (
              <p className="rounded-2xl rounded-tr-sm bg-secondary px-3.5 py-2.5 text-sm text-pretty lg:max-w-sm">
                {profile.aiSummary}
              </p>
            )
          )}
        </div>

        <ul
          aria-label={`Events ${name} checked in to`}
          className="flex flex-wrap gap-1.5"
        >
          {events.slice(0, 6).map((event) => (
            <li key={event.eventId} className="flex">
              <Badge variant={evidence.has(event.eventId) ? "default" : "outline"}>
                {event.title} · {dateFormat.format(new Date(event.startsAt))}
              </Badge>
            </li>
          ))}
          {events.length > 6 && (
            <li className="flex">
              <Badge variant="outline">+{events.length - 6} more</Badge>
            </li>
          )}
          {events.length === 0 && (
            <li className="text-sm text-muted-foreground">No check-ins yet.</li>
          )}
        </ul>

        {links.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant={saved ? "secondary" : "outline"}
        size="sm"
        className="mt-1.5 shrink-0"
        aria-pressed={saved}
        onClick={onToggleSave}
      >
        {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
        <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
        <span className="sr-only sm:hidden">{saved ? "Saved" : "Save"}</span>
      </Button>
    </article>
  );
}

export function RecruiterSearch() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<AttendedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<RecruiterMatch[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRecruiterVisibleProfiles(), listVisibleAttendance()])
      .then(([loadedProfiles, loadedAttendance]) => {
        if (cancelled) return;
        setProfiles(loadedProfiles);
        setAttendance(loadedAttendance);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load students.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const attendedBy = useMemo(() => {
    const map = new Map<string, AttendedEvent[]>();
    for (const event of attendance) {
      map.set(event.profileId, [...(map.get(event.profileId) ?? []), event]);
    }
    return map;
  }, [attendance]);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  async function search(text: string) {
    const trimmed = text.trim();
    if (!trimmed || searching) return;
    setQuery(trimmed);
    setSearching(true);
    setSearchError(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The model can hang. Give up after a while, so the box is never stuck searching.
      const result = await Promise.race([
        postJson<RecruiterSearchResponse>("/api/ai/recruiter-search", { query: trimmed }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("The search took too long. Try again.")),
            SEARCH_TIMEOUT_MS,
          );
        }),
      ]);
      setMatches(result.matches);
      setSearched(trimmed);
    } catch (error) {
      setSearchError(searchMessage(error));
    } finally {
      clearTimeout(timer);
      setSearching(false);
    }
  }

  function clearSearch() {
    setMatches(null);
    setSearched(null);
    setQuery("");
    setSearchError(null);
  }

  function toggleSave(id: string) {
    setShortlist((current) =>
      current.includes(id) ? current.filter((saved) => saved !== id) : [...current, id],
    );
  }

  const rows: { profile: Profile; match?: RecruiterMatch }[] = matches
    ? matches.flatMap((match) => {
        const profile = profileById.get(match.profileId);
        return profile ? [{ profile, match }] : [];
      })
    : profiles.map((profile) => ({ profile }));

  const saved = shortlist.flatMap((id) => profileById.get(id) ?? []);

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      <section className="mx-auto max-w-2xl pt-12 pb-8 text-center sm:pt-16">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Find students who show up
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          Every event here was scanned at the door. You only see students who chose to be visible.
        </p>

        <form
          className="mt-7 rounded-2xl border bg-card p-2 text-left shadow-sm transition-shadow focus-within:border-ring focus-within:shadow-md"
          onSubmit={(event) => {
            event.preventDefault();
            search(query);
          }}
        >
          <label htmlFor="recruiter-query" className="sr-only">
            Describe the students you are looking for
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="recruiter-query"
              rows={2}
              // Short, so it fits the two rows on a phone without a scrollbar.
              placeholder="Describe who you are looking for"
              className="min-h-14 flex-1 resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  search(query);
                }
              }}
            />
            <VoiceButton
              value={query}
              onChange={setQuery}
              onDone={() => document.getElementById("recruiter-query")?.focus()}
              disabled={searching}
            />
            <Button
              type="submit"
              size="icon-lg"
              className="size-10 shrink-0 rounded-full"
              disabled={searching || !query.trim()}
              aria-label={searching ? "Searching" : "Search with AI"}
            >
              {searching ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <ArrowUp aria-hidden />
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={searching}
              onClick={() => search(example)}
              className="rounded-full border px-3 py-1 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>

        {/* Keeps one line of height, so the list below does not jump when a search starts. */}
        <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-pretty">
          {searching ? (
            <span className="text-muted-foreground">
              Reading attendance records. This takes about 20 seconds.
            </span>
          ) : (
            <span className="text-destructive">{searchError ?? loadError}</span>
          )}
        </p>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex items-baseline justify-between gap-4 border-b pb-3">
            <h2 id="results-heading" className="text-sm text-muted-foreground">
              {loading ? (
                "Loading students…"
              ) : searched ? (
                <>
                  {rows.length} {rows.length === 1 ? "match" : "matches"} for{" "}
                  <span className="font-medium text-foreground">{searched}</span>
                </>
              ) : (
                `${profiles.length} ${profiles.length === 1 ? "student has" : "students have"} opted in`
              )}
            </h2>
            {searched && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSearch}>
                <X aria-hidden />
                Clear
              </Button>
            )}
          </div>

          {loading ? (
            <div aria-hidden className="divide-y">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex gap-4 py-5">
                  <Skeleton className="size-11 shrink-0 rounded-full motion-reduce:animate-none" />
                  <div className="flex-1 space-y-2.5 pt-1">
                    <Skeleton className="h-4 w-40 motion-reduce:animate-none" />
                    <Skeleton className="h-4 w-56 max-w-full motion-reduce:animate-none" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-pretty text-muted-foreground">
              {searched
                ? "No opted-in student has attendance that fits. Try a broader search."
                : "No student has opted in yet. Students turn this on from their profile."}
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map(({ profile, match }, index) => (
                <li key={profile.id}>
                  <StudentRow
                    profile={profile}
                    attended={attendedBy.get(profile.id) ?? []}
                    rank={match ? index + 1 : undefined}
                    match={match}
                    saved={shortlist.includes(profile.id)}
                    onToggleSave={() => toggleSave(profile.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="shortlist-heading" className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border p-4">
            <h2 id="shortlist-heading" className="flex items-center justify-between font-medium">
              Your shortlist
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {saved.length}
              </span>
            </h2>
            {saved.length === 0 ? (
              <p className="mt-2 text-sm text-pretty text-muted-foreground">
                Save students to compare them here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {saved.map((profile) => (
                  <li key={profile.id} className="flex items-center gap-2.5">
                    <Avatar profile={profile} className="size-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {profile.fullName || "Unnamed student"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{subtitle(profile)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${profile.fullName || "student"} from shortlist`}
                      onClick={() => toggleSave(profile.id)}
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl bg-secondary p-4 text-sm text-pretty">
            <p className="flex items-center gap-1.5 font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden />
              How the AI ranks
            </p>
            <p className="mt-1.5 text-muted-foreground">
              It sees major, graduation year and attended events only. Never names, emails or
              links. Attendance shows interest, not skill, and highlighted events are the evidence
              for each match.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
