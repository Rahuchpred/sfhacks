"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/api";
import { listRecruiterVisibleProfiles, listVisibleAttendance } from "@/lib/db";
import type {
  AttendedEvent,
  Profile,
  RecruiterMatch,
  RecruiterSearchResponse,
} from "@/lib/types";

const EXAMPLES = [
  "Students who go to machine learning workshops and hackathons",
  "People active in cultural clubs",
  "Students who show up to career events",
];

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

type StudentCardProps = {
  profile: Profile;
  attended: AttendedEvent[];
  match?: RecruiterMatch;
};

function StudentCard({ profile, attended, match }: StudentCardProps) {
  const evidence = new Set(match?.evidenceEventIds);
  const links = [
    profile.linkedinUrl && { label: "LinkedIn", href: profile.linkedinUrl },
    profile.githubUrl && { label: "GitHub", href: profile.githubUrl },
    profile.resumeUrl && { label: "Resume", href: profile.resumeUrl },
  ].filter((link): link is { label: string; href: string } => Boolean(link));

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{profile.fullName || "Unnamed student"}</span>
            {profile.sfsuVerified && (
              <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified SFSU student" />
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {[profile.major, profile.gradYear ? `Class of ${profile.gradYear}` : null]
              .filter(Boolean)
              .join(" · ") || "No major listed"}
          </p>
        </div>

        {match && (
          <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-pretty">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium">Why this match (AI): </span>
              {match.reason}
            </span>
          </p>
        )}

        {profile.aiSummary && !match && (
          <p className="text-sm text-pretty text-muted-foreground">{profile.aiSummary}</p>
        )}

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Checked in to {attended.length} {attended.length === 1 ? "event" : "events"}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {attended.slice(0, 8).map((event) => (
              <li key={event.eventId} className="flex">
                <Badge variant={evidence.has(event.eventId) ? "default" : "secondary"}>
                  {event.title} · {dateFormat.format(new Date(event.startsAt))}
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        {links.length > 0 && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {link.label}
              </a>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function RecruiterSearch() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<AttendedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<RecruiterMatch[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRecruiterVisibleProfiles(), listVisibleAttendance()])
      .then(([loadedProfiles, loadedAttendance]) => {
        if (cancelled) return;
        setProfiles(loadedProfiles);
        setAttendance(loadedAttendance);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load students.");
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
    try {
      const result = await postJson<RecruiterSearchResponse>("/api/ai/recruiter-search", {
        query: trimmed,
      });
      setMatches(result.matches);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  const matched = matches
    ?.map((match) => ({ match, profile: profileById.get(match.profileId) }))
    .filter((item): item is { match: RecruiterMatch; profile: Profile } => Boolean(item.profile));

  return (
    <div className="mt-6 space-y-6">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          search(query);
        }}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="What kind of student are you looking for?"
            placeholder="Students who go to machine learning workshops…"
            className="h-10 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="h-10 px-4" disabled={searching || !query.trim()}>
          {searching ? (
            <>
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              Searching…
            </>
          ) : (
            "Search with AI"
          )}
        </Button>
        {matches && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 px-4"
            onClick={() => {
              setMatches(null);
              setQuery("");
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {!matches && (
        <ul className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <li key={example} className="flex">
              <Button type="button" variant="secondary" size="sm" onClick={() => search(example)}>
                {example}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p role="status" aria-live="polite" className="text-sm text-destructive empty:hidden">
        {searchError ?? loadError}
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading students…</p>
      ) : matched ? (
        <section aria-label="Matches" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {matched.length === 0
              ? "No opted-in student has attendance that fits. Try a broader search."
              : `${matched.length} ${matched.length === 1 ? "match" : "matches"}, best fit first. Highlighted events are the evidence.`}
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {matched.map(({ match, profile }) => (
              <li key={profile.id} className="min-w-0">
                <StudentCard
                  profile={profile}
                  attended={attendedBy.get(profile.id) ?? []}
                  match={match}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label="Visible students" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {profiles.length === 0
              ? "No student has opted in yet. Students turn this on from their profile."
              : `${profiles.length} ${profiles.length === 1 ? "student has" : "students have"} opted in.`}
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {profiles.map((profile) => (
              <li key={profile.id} className="min-w-0">
                <StudentCard profile={profile} attended={attendedBy.get(profile.id) ?? []} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="max-w-2xl text-xs text-pretty text-muted-foreground">
        The AI ranks on major, graduation year and attended events only. It never sees names,
        emails or links, and attendance shows interest, not skill. Students can turn visibility off
        at any time.
      </p>
    </div>
  );
}
