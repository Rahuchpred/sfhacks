// Mobbin reference: Mercor profile (web), a header with the person, then stacked sections and a details column.
"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useUser } from "@/components/auth-provider";
import { countLabel } from "@/components/map/map-utils";
import { AttendanceList } from "@/components/profile/attendance-list";
import { DetailsForm } from "@/components/profile/details-form";
import { attendanceStats, attendedTickets } from "@/components/profile/profile-utils";
import { StatsRow } from "@/components/profile/stats-row";
import { SummaryCard } from "@/components/profile/summary-card";
import { VisibilityCard } from "@/components/profile/visibility-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MyHelp } from "@/components/help/my-help";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProfile, listMyTickets } from "@/lib/db";
import type { Profile, TicketWithEvent } from "@/lib/types";

type Loaded =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; profile: Profile | null; tickets: TicketWithEvent[] };

// The profile fills itself from attendance. Attendance on the left, details on the right.
export default function ProfilePage() {
  const user = useUser();
  const userId = user?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // The anonymous session can take a moment, so wait for the user before loading.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([getMyProfile(), listMyTickets()])
      .then(([profile, tickets]) => {
        if (!cancelled) setLoaded({ status: "ready", profile, tickets });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  function retry() {
    setLoaded({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:py-10">
      {loaded.status === "loading" && <ProfileSkeleton />}
      {loaded.status === "error" && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">Your profile</h1>
          <p className="text-sm text-muted-foreground">Could not load your profile.</p>
          <Button type="button" variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
      {loaded.status === "ready" && (
        <ProfileView
          profile={loaded.profile}
          tickets={loaded.tickets}
          onSaved={(profile) =>
            setLoaded((current) => (current.status === "ready" ? { ...current, profile } : current))
          }
        />
      )}
    </div>
  );
}

function ProfileView({
  profile,
  tickets,
  onSaved,
}: {
  profile: Profile | null;
  tickets: TicketWithEvent[];
  onSaved: (profile: Profile) => void;
}) {
  const attended = useMemo(() => attendedTickets(tickets), [tickets]);
  const stats = useMemo(() => attendanceStats(attended), [attended]);
  const name = profile?.fullName.trim();

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <span
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground uppercase sm:size-20 sm:text-3xl"
        >
          {name ? name.charAt(0) : "?"}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="min-w-0 text-3xl font-semibold tracking-tight text-balance break-words md:text-4xl">
              {name || "Your profile"}
            </h1>
            {profile?.sfsuVerified && (
              <Badge>
                <BadgeCheck aria-hidden />
                Verified SFSU student
              </Badge>
            )}
          </div>
          {(profile?.major || profile?.gradYear) && (
            <p className="min-w-0 text-sm font-medium break-words">
              {[profile.major, profile.gradYear && `Class of ${profile.gradYear}`]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {profile?.email && (
            <p className="min-w-0 text-sm break-words text-muted-foreground">{profile.email}</p>
          )}
          {profile?.bio && (
            <p className="max-w-prose text-sm leading-relaxed break-words text-muted-foreground">
              {profile.bio}
            </p>
          )}
          {!name && (
            <p className="text-sm text-pretty text-muted-foreground">
              Add your name to get started.
            </p>
          )}
        </div>
      </header>

      <StatsRow stats={stats} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="attended-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="attended-heading" className="text-lg font-semibold tracking-tight text-balance">
                Events I showed up to
              </h2>
              {attended.length > 0 && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  {countLabel(attended.length, "event")}
                </p>
              )}
            </div>
            <AttendanceList attended={attended} />
          </section>

          <SummaryCard profile={profile} attended={attended} onSaved={onSaved} />

          <MyHelp />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/* Keyed so the fields start from the loaded profile without an effect. */}
          <DetailsForm key={profile?.id ?? "new"} profile={profile} onSaved={onSaved} />
          <VisibilityCard profile={profile} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:gap-8" aria-busy="true">
      <p role="status" className="sr-only">
        Loading your profile…
      </p>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="col-span-2 h-16 rounded-xl sm:col-span-1" />
          </div>
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
