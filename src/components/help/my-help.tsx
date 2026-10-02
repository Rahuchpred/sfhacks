"use client";

// Mobbin reference: Mercor "Applications" tab (one bordered row per
// application, title and terms on the left, date and a status pill on the
// right, grouped under small section labels).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/components/auth-provider";
import { listMyHelpOffers } from "@/lib/db";
import type { MyHelpOffer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OfferStatusBadge, RewardBadge, helpDateFormat } from "./help-shared";

function OfferRow({ offer }: { offer: MyHelpOffer }) {
  const { request } = offer;
  const done = offer.status === "done";
  return (
    <Link
      href={`/help/${request.id}`}
      className="flex flex-col gap-2 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{request.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[request.requesterName, request.department].filter(Boolean).join(", ")}
        </p>
        {done && request.rewardDetail && (
          <p className="mt-1 line-clamp-2 text-sm text-pretty">{request.rewardDetail}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {done ? (
          <>
            <RewardBadge type={request.rewardType} />
            {offer.completedAt && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {helpDateFormat.format(new Date(offer.completedAt))}
              </span>
            )}
          </>
        ) : (
          <OfferStatusBadge status={offer.status} />
        )}
      </div>
    </Link>
  );
}

function Group({ title, offers }: { title: string; offers: MyHelpOffer[] }) {
  if (offers.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({offers.length})</span>
      </h3>
      <ul className="space-y-2">
        {offers.map((offer) => (
          <li key={offer.id}>
            <OfferRow offer={offer} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// The student's help offers, for the profile page. Renders nothing when there are none.
export function MyHelp({ className }: { className?: string }) {
  const userId = useUser()?.id ?? null;
  const [offers, setOffers] = useState<MyHelpOffer[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    listMyHelpOffers().then(
      (loaded) => {
        if (active) {
          setOffers(loaded);
          setFailed(false);
        }
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [userId]);

  if (failed) {
    return (
      <p role="alert" className={cn("text-sm text-destructive", className)}>
        Could not load your help history.
      </p>
    );
  }

  const given = offers.filter((offer) => offer.status === "done");
  const inProgress = offers.filter(
    (offer) => offer.status === "pending" || offer.status === "accepted",
  );
  if (given.length === 0 && inProgress.length === 0) return null;

  return (
    <section aria-label="Help" className={cn("space-y-5", className)}>
      <Group title="Help I gave" offers={given} />
      <Group title="In progress" offers={inProgress} />
    </section>
  );
}
