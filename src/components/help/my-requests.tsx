"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, HandHelping, Loader2, Plus, TriangleAlert, X } from "lucide-react";
import { useUser } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listHelpOffers,
  listMyHelpRequests,
  setHelpOfferStatus,
  setHelpRequestStatus,
} from "@/lib/db";
import type { HelpOffer, HelpOfferStatus, HelpRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

// Mobbin references: Workable's Jobs page (one card per posting with its status
// control on the right) and Juicebox's candidate rows (name, a line of facts,
// then a short note, with actions at the end of the row).

// Offers per request: a list, or a message when they could not be loaded.
type Offers = HelpOffer[] | { error: string };

const STATUS_LABEL: Record<HelpOfferStatus, string> = {
  pending: "New",
  accepted: "Accepted",
  declined: "Declined",
  done: "Done",
};

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function OfferRow({
  offer,
  onStatus,
}: {
  offer: HelpOffer;
  onStatus: (status: "accepted" | "declined" | "done") => Promise<void>;
}) {
  const [pending, setPending] = useState<HelpOfferStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = offer.studentName || "Unnamed student";
  const facts = [
    offer.major,
    offer.gradYear ? `Class of ${offer.gradYear}` : null,
    `checked in to ${offer.eventsAttended} ${offer.eventsAttended === 1 ? "event" : "events"}`,
  ].filter(Boolean);

  async function change(status: "accepted" | "declined" | "done") {
    if (pending) return;
    setPending(status);
    setError(null);
    try {
      await onStatus(status);
      setConfirming(false);
    } catch (changeError) {
      setError(message(changeError, "Could not save. Try again."));
    } finally {
      setPending(null);
    }
  }

  const spinner = <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary"
        >
          {initials(offer.studentName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 truncate font-medium">{name}</h3>
            {offer.sfsuVerified && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                <BadgeCheck className="size-4" aria-hidden />
                Verified SFSU
              </span>
            )}
            <Badge
              variant={offer.status === "pending" ? "default" : "outline"}
              className={cn(
                offer.status === "done" && "border-transparent bg-accent text-accent-foreground",
                offer.status === "declined" && "text-muted-foreground",
              )}
            >
              {STATUS_LABEL[offer.status]}
            </Badge>
          </div>
          <p className="text-sm text-pretty text-muted-foreground">{facts.join(" · ")}</p>
          {offer.note && (
            <p className="mt-2 w-fit max-w-prose rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2 text-sm text-pretty break-words">
              {offer.note}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 pl-13 sm:items-end sm:pl-0">
        {offer.status === "pending" && (
          <div className="flex gap-2">
            <Button className="h-9 px-3" disabled={pending !== null} onClick={() => change("accepted")}>
              {pending === "accepted" ? spinner : <Check aria-hidden />}
              Accept
            </Button>
            <Button
              variant="outline"
              className="h-9 px-3"
              disabled={pending !== null}
              onClick={() => change("declined")}
            >
              {pending === "declined" ? spinner : <X aria-hidden />}
              Decline
            </Button>
          </div>
        )}
        {offer.status === "accepted" && !confirming && (
          <Button variant="outline" className="h-9 px-3" onClick={() => setConfirming(true)}>
            <Check aria-hidden />
            Mark done
          </Button>
        )}
        {offer.status === "accepted" && confirming && (
          <div className="flex flex-col gap-2 sm:items-end">
            <p className="text-sm text-pretty">This adds the help to their profile.</p>
            <div className="flex gap-2">
              <Button className="h-9 px-3" disabled={pending !== null} onClick={() => change("done")}>
                {pending === "done" && spinner}
                Confirm
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-3"
                disabled={pending !== null}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function RequestCard({
  request,
  offers,
  onRequestStatus,
  onOfferStatus,
}: {
  request: HelpRequest;
  offers: Offers | undefined;
  onRequestStatus: (status: HelpRequest["status"]) => Promise<void>;
  onOfferStatus: (offerId: string, status: "accepted" | "declined" | "done") => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = request.status === "open";
  const list = Array.isArray(offers) ? offers : [];
  const filled = list.filter((offer) => offer.status === "accepted" || offer.status === "done").length;

  async function toggle() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onRequestStatus(open ? "closed" : "open");
    } catch (toggleError) {
      setError(message(toggleError, "Could not save. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 font-semibold text-balance break-words">
              <Link
                href={`/help/${request.id}`}
                className="underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {request.title}
              </Link>
            </h2>
            <Badge variant={open ? "default" : "outline"}>{open ? "Open" : "Closed"}</Badge>
          </div>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {[
              request.rewardType.charAt(0).toUpperCase() + request.rewardType.slice(1),
              request.timeNeeded,
              `${filled} of ${request.spots} ${request.spots === 1 ? "spot" : "spots"} filled`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button variant="outline" className="h-9 shrink-0 px-3" disabled={saving} onClick={toggle}>
          {saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {open ? "Close" : "Reopen"}
        </Button>
      </div>

      <div className="border-t px-4 sm:px-5">
        {offers === undefined ? (
          <div aria-busy="true" className="flex items-center gap-3 py-4">
            <p role="status" className="sr-only">
              Loading offers
            </p>
            <Skeleton className="size-10 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-4 w-40 motion-reduce:animate-none" />
          </div>
        ) : !Array.isArray(offers) ? (
          <p role="alert" className="py-4 text-sm text-destructive">
            Could not load offers. {offers.error}
          </p>
        ) : offers.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No offers yet.</p>
        ) : (
          <ul aria-label={`Offers for ${request.title}`} className="divide-y">
            {offers.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                onStatus={(status) => onOfferStatus(offer.id, status)}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function MyRequests() {
  const user = useUser();
  const userId = user?.id;
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [offers, setOffers] = useState<Record<string, Offers>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Wait for the session, or the list would come back empty.
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const mine = await listMyHelpRequests();
        if (cancelled) return;
        setRequests(mine);
        setError(null);
        setLoading(false);
        await Promise.all(
          mine.map(async (request) => {
            let loaded: Offers;
            try {
              loaded = await listHelpOffers(request.id);
            } catch (offersError) {
              loaded = { error: message(offersError, "Reload the page.") };
            }
            if (!cancelled) setOffers((current) => ({ ...current, [request.id]: loaded }));
          }),
        );
      } catch (loadError) {
        if (cancelled) return;
        setError(message(loadError, "Check your connection."));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  async function changeRequest(id: string, status: HelpRequest["status"]) {
    await setHelpRequestStatus(id, status);
    setRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status } : request)),
    );
  }

  async function changeOffer(
    requestId: string,
    offerId: string,
    status: "accepted" | "declined" | "done",
  ) {
    const allowed = await setHelpOfferStatus(offerId, status);
    if (!allowed) throw new Error("You cannot change this offer.");
    setOffers((current) => {
      const list = current[requestId];
      if (!Array.isArray(list)) return current;
      return {
        ...current,
        [requestId]: list.map((offer) => (offer.id === offerId ? { ...offer, status } : offer)),
      };
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pt-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
        <Link href="/help/new" className={cn(buttonVariants(), "h-9 px-3")}>
          <Plus aria-hidden />
          Ask for help
        </Link>
      </div>

      {loading ? (
        <div aria-busy="true" className="mt-6 space-y-4">
          <p role="status" className="sr-only">
            Loading your requests
          </p>
          <Skeleton className="h-36 w-full rounded-xl motion-reduce:animate-none" />
          <Skeleton className="h-36 w-full rounded-xl motion-reduce:animate-none" />
        </div>
      ) : error ? (
        <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <TriangleAlert className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">Could not load your requests</h2>
          <p className="text-sm text-pretty break-words text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            className="h-10 px-4"
            onClick={() => {
              setLoading(true);
              setAttempt((current) => current + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <HandHelping className="size-6 text-primary" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">No requests yet</h2>
          <Link href="/help/new" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
            Ask for help
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              offers={offers[request.id]}
              onRequestStatus={(status) => changeRequest(request.id, status)}
              onOfferStatus={(offerId, status) => changeOffer(request.id, offerId, status)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
