"use client";

// Mobbin reference: Mercor "Explore opportunities" (search box over a filter
// row, stacked opportunity cards with the pay line under the title) and
// GetYourGuide (pill filter chips above a card grid, with a plain no-results
// state).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Search, Users, X } from "lucide-react";
import { useUser } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listBuildings, listMyHelpOffers, listOpenHelpRequests } from "@/lib/db";
import { REWARD_TYPES } from "@/lib/types";
import type { Building, HelpOfferStatus, HelpRequest, RewardType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OfferStatusBadge, REWARD_LABELS, RewardBadge, spotsLabel } from "./help-shared";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; requests: HelpRequest[] };

const grid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

const chip =
  "rounded-full border px-3 py-1 text-sm transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

function RequestCard({
  request,
  building,
  offer,
}: {
  request: HelpRequest;
  building: string | null;
  offer?: HelpOfferStatus;
}) {
  return (
    <Link
      href={`/help/${request.id}`}
      className="flex h-full flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-md hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RewardBadge type={request.rewardType} />
        {offer && <OfferStatusBadge status={offer} />}
      </div>

      <div className="min-w-0 space-y-1">
        <h2 className="font-medium text-balance">{request.title}</h2>
        <p className="text-sm text-muted-foreground">
          {[request.requesterName, request.department].filter(Boolean).join(", ")}
        </p>
      </div>

      {request.rewardDetail && (
        <p className="line-clamp-2 text-sm text-pretty">{request.rewardDetail}</p>
      )}

      {request.skills.length > 0 && (
        <ul aria-label="Skills" className="flex flex-wrap gap-1.5">
          {request.skills.slice(0, 4).map((skill) => (
            <li key={skill} className="flex">
              <Badge variant="outline">{skill}</Badge>
            </li>
          ))}
          {request.skills.length > 4 && (
            <li className="flex">
              <Badge variant="outline">+{request.skills.length - 4}</Badge>
            </li>
          )}
        </ul>
      )}

      <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
        <div className="flex items-center gap-1.5">
          <dt>
            <Clock aria-hidden />
            <span className="sr-only">Time needed</span>
          </dt>
          <dd>{request.timeNeeded}</dd>
        </div>
        {building && (
          <div className="flex items-center gap-1.5">
            <dt>
              <MapPin aria-hidden />
              <span className="sr-only">Building</span>
            </dt>
            <dd>{building}</dd>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <dt>
            <Users aria-hidden />
            <span className="sr-only">Spots</span>
          </dt>
          <dd className="tabular-nums">{spotsLabel(request.spots)}</dd>
        </div>
      </dl>
    </Link>
  );
}

function LoadingGrid() {
  const pulse = "motion-reduce:animate-none";
  return (
    <div className={grid} role="status" aria-label="Loading requests…">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl p-4 ring-1 ring-foreground/10">
          <Skeleton className={cn("h-5 w-28 rounded-full", pulse)} />
          <Skeleton className={cn("h-5 w-4/5", pulse)} />
          <Skeleton className={cn("h-4 w-1/2", pulse)} />
          <Skeleton className={cn("h-4 w-full", pulse)} />
          <Skeleton className={cn("h-4 w-2/3", pulse)} />
        </div>
      ))}
    </div>
  );
}

export function HelpBoard() {
  const userId = useUser()?.id ?? null;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [offers, setOffers] = useState<Map<string, HelpOfferStatus>>(new Map());
  const [attempt, setAttempt] = useState(0);

  const [query, setQuery] = useState("");
  const [reward, setReward] = useState<RewardType | null>(null);

  useEffect(() => {
    let active = true;
    listOpenHelpRequests().then(
      (requests) => {
        if (active) setState({ status: "ready", requests });
      },
      () => {
        if (active) setState({ status: "error" });
      },
    );
    // Building names are a nice-to-have: cards still read fine without them.
    listBuildings().then(
      (loaded) => {
        if (active) setBuildings(loaded);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  // Marks the requests this student already offered on.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    listMyHelpOffers().then(
      (mine) => {
        if (active) setOffers(new Map(mine.map((offer) => [offer.requestId, offer.status])));
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const buildingName = useMemo(
    () => new Map(buildings.map((building) => [building.id, building.name])),
    [buildings],
  );

  const requests = state.status === "ready" ? state.requests : [];
  const needle = query.trim().toLowerCase();
  const visible = requests.filter((request) => {
    if (reward && request.rewardType !== reward) return false;
    if (!needle) return true;
    return [request.title, request.department, ...request.skills].some((text) =>
      text.toLowerCase().includes(needle),
    );
  });
  const filtered = Boolean(needle || reward);

  function clearFilters() {
    setQuery("");
    setReward(null);
  }

  function retry() {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Help board</h1>

      <div className="mt-5 space-y-3">
        <div className="relative max-w-md">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search title, skill or department"
            placeholder="Title, skill or department"
            className="h-10 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div role="group" aria-label="What you get" className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chip}
            aria-pressed={reward === null}
            onClick={() => setReward(null)}
          >
            All
          </button>
          {REWARD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={chip}
              aria-pressed={reward === type}
              onClick={() => setReward(reward === type ? null : type)}
            >
              {REWARD_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Open requests" className="mt-6">
        {state.status === "loading" ? (
          <LoadingGrid />
        ) : state.status === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-destructive">Could not load requests.</p>
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {filtered ? "No requests match." : "No open requests yet."}
            </p>
            {filtered && (
              <Button variant="outline" onClick={clearFilters}>
                <X aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <p aria-live="polite" className="mb-3 text-sm text-muted-foreground tabular-nums">
              {visible.length} open
            </p>
            <ul className={grid}>
              {visible.map((request) => (
                <li key={request.id}>
                  <RequestCard
                    request={request}
                    building={
                      request.buildingId ? (buildingName.get(request.buildingId) ?? null) : null
                    }
                    offer={offers.get(request.id)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
