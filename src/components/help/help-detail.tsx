"use client";

// Mobbin reference: Mercor opportunity detail (title with the pay beside it,
// "Posted by" row, an application status block and one full-width action) and
// Zillow unit detail (action buttons above a grid of fact tiles and chips).

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getHelpRequest,
  getMyProfile,
  listBuildings,
  listMyHelpOffers,
  offerHelp,
  saveMyProfile,
  withdrawHelpOffer,
} from "@/lib/db";
import type { HelpOfferStatus, HelpRequest, MyHelpOffer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OfferStatusBadge, RewardBadge, Spinner, helpDateFormat, spotsLabel } from "./help-shared";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; request: HelpRequest | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const columns = "grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-10";
const sideHeading = "border-b pb-2 text-sm font-medium text-muted-foreground";

const STATUS_LINES: Record<HelpOfferStatus, string> = {
  pending: "Waiting for a reply",
  accepted: "You are in",
  declined: "Not this time",
  done: "Thanks for helping",
};

// Postgres unique violation: this student already has an offer on the request.
function isDuplicate(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-10">
      <Link
        href="/help"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-5 -ml-2 text-muted-foreground",
        )}
      >
        <ArrowLeft aria-hidden />
        Help board
      </Link>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  const pulse = "motion-reduce:animate-none";
  return (
    <div className={columns} role="status" aria-label="Loading…">
      <div className="space-y-5">
        <Skeleton className={cn("h-5 w-28 rounded-full", pulse)} />
        <Skeleton className={cn("h-9 w-4/5", pulse)} />
        <Skeleton className={cn("h-4 w-64 max-w-full", pulse)} />
        <Skeleton className={cn("h-24 w-full", pulse)} />
        <Skeleton className={cn("h-16 w-full rounded-xl", pulse)} />
      </div>
      <Skeleton className={cn("h-48 w-full rounded-xl", pulse)} />
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
      {children}
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-secondary px-3 py-2.5">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium">{children}</dd>
      </div>
    </div>
  );
}

type OfferPanelProps = {
  request: HelpRequest;
  offer: MyHelpOffer | null;
  // False until the anonymous session exists and the offer lookup has finished.
  ready: boolean;
  mine: boolean;
  onChange: () => Promise<void>;
};

function OfferPanel({ request, offer, ready, mine, onChange }: OfferPanelProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState("");
  const noteId = useId();
  const nameId = useId();
  const closed = request.status === "closed";

  async function send() {
    try {
      await offerHelp(request.id, note.trim());
      setNote("");
      toast.success("Offer sent.");
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      toast.info("You already offered to help.");
    }
    await onChange();
  }

  async function offerToHelp() {
    setBusy(true);
    try {
      const profile = await getMyProfile();
      if (!profile || !profile.fullName.trim()) {
        setNameOpen(true);
        return;
      }
      await send();
    } catch {
      toast.error("Could not send your offer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = name.trim();
    if (!fullName) return;
    setBusy(true);
    try {
      await saveMyProfile({ fullName });
      await send();
      setNameOpen(false);
    } catch {
      toast.error("Could not send your offer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!offer) return;
    setBusy(true);
    try {
      await withdrawHelpOffer(offer.id);
      await onChange();
    } catch {
      toast.error("Could not withdraw. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <p className="border-b bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
        {mine ? "Your request" : offer ? "Your offer" : ready ? "Offer to help" : " "}
      </p>

      {mine ? (
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground tabular-nums">
            {closed ? "Closed" : "Open"}, {spotsLabel(request.spots)}
          </p>
          <Link
            href="/help/mine"
            className={cn(buttonVariants({ variant: "outline" }), "h-10 w-full")}
          >
            See offers
          </Link>
        </CardContent>
      ) : offer ? (
        <CardContent className="space-y-3 p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-balance">
              {STATUS_LINES[offer.status]}
            </h2>
            <OfferStatusBadge status={offer.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {offer.status === "done" && offer.completedAt
              ? `Completed ${helpDateFormat.format(new Date(offer.completedAt))}`
              : `Sent ${helpDateFormat.format(new Date(offer.createdAt))}`}
          </p>
          {offer.note && (
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-pretty break-words whitespace-pre-line">
              {offer.note}
            </p>
          )}
          {closed && offer.status === "pending" && (
            <p className="text-sm text-muted-foreground">This request is closed</p>
          )}
          {offer.status === "pending" && (
            <Button
              variant="outline"
              className="h-10 w-full hover:text-destructive"
              disabled={busy}
              onClick={withdraw}
            >
              {busy && <Spinner />}
              {busy ? "Withdrawing…" : "Withdraw offer"}
            </Button>
          )}
        </CardContent>
      ) : !ready ? (
        // Until the lookup is back, so the form never flashes before an offer.
        <CardContent className="space-y-3 p-4" aria-busy="true">
          <Skeleton className="h-5 w-32 motion-reduce:animate-none" />
          <Skeleton className="h-16 w-full motion-reduce:animate-none" />
          <Skeleton className="h-10 w-full motion-reduce:animate-none" />
        </CardContent>
      ) : closed ? (
        <CardContent className="p-4">
          <h2 className="text-base font-semibold tracking-tight text-balance">
            This request is closed
          </h2>
        </CardContent>
      ) : (
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2">
            <Label htmlFor={noteId}>Note</Label>
            <Textarea
              id={noteId}
              rows={3}
              maxLength={300}
              placeholder="Why you, when you are free"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <Button
            size="lg"
            className="h-10 w-full text-base"
            disabled={!ready || busy}
            onClick={offerToHelp}
          >
            {(busy || !ready) && <Spinner />}
            {busy ? "Sending…" : "Offer to help"}
          </Button>
        </CardContent>
      )}

      <Dialog open={nameOpen} onOpenChange={(open) => !busy && setNameOpen(open)}>
        <DialogContent>
          <form onSubmit={submitName} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>What is your name?</DialogTitle>
              <DialogDescription>{request.requesterName} sees it with your offer.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={nameId}>Full name</Label>
              <Input
                id={nameId}
                name="name"
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || !name.trim()} className="sm:min-w-28">
                {busy && <Spinner />}
                {busy ? "Sending…" : "Offer to help"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// The request page body. Remount with a key when the id changes.
export function HelpDetail({ id }: { id: string }) {
  const userId = useUser()?.id ?? null;
  // An id that is not a UUID can never match a row, and the database rejects it.
  const valid = UUID.test(id);

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [building, setBuilding] = useState<string | null>(null);
  const [offer, setOffer] = useState<MyHelpOffer | null>(null);
  const [offerReady, setOfferReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (valid ? getHelpRequest(id) : Promise.resolve(null)).then(
      (request) => {
        if (active) setState({ status: "ready", request });
      },
      () => {
        if (active) setState({ status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [id, valid, attempt]);

  const buildingId = state.status === "ready" ? (state.request?.buildingId ?? null) : null;
  useEffect(() => {
    if (!buildingId) return;
    let active = true;
    listBuildings().then(
      (buildings) => {
        if (active) setBuilding(buildings.find((item) => item.id === buildingId)?.name ?? null);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [buildingId]);

  // Also refreshes the request, so a request closed meanwhile shows as closed.
  const reload = useCallback(async () => {
    const [request, offers] = await Promise.all([getHelpRequest(id), listMyHelpOffers()]);
    setState({ status: "ready", request });
    setOffer(offers.find((item) => item.requestId === id) ?? null);
  }, [id]);

  useEffect(() => {
    if (!userId || !valid) return;
    let active = true;
    listMyHelpOffers()
      .then(
        (offers) => {
          if (active) setOffer(offers.find((item) => item.requestId === id) ?? null);
        },
        () => {
          // Offering still works without the lookup: a duplicate is caught on send.
        },
      )
      .finally(() => {
        if (active) setOfferReady(true);
      });
    return () => {
      active = false;
    };
  }, [id, userId, valid]);

  if (state.status === "loading") {
    return (
      <Shell>
        <LoadingSkeleton />
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <Message title="Could not load this request">
          <Button
            variant="outline"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((current) => current + 1);
            }}
          >
            Try again
          </Button>
        </Message>
      </Shell>
    );
  }

  const request = state.request;
  if (!request) {
    return (
      <Shell>
        <Message title="Request not found">
          <Link href="/help" className={buttonVariants({ variant: "outline" })}>
            Browse the help board
          </Link>
        </Message>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={columns}>
        <article className="min-w-0 space-y-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <RewardBadge type={request.rewardType} />
              {request.status === "closed" && <Badge variant="outline">Closed</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {request.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[request.requesterName, request.department].filter(Boolean).join(", ")}
            </p>
          </header>

          <dl className="grid gap-2 sm:grid-cols-3">
            <Fact icon={Clock} label="Time">
              {request.timeNeeded}
            </Fact>
            <Fact icon={Users} label="Spots">
              <span className="tabular-nums">{request.spots}</span>
            </Fact>
            {building && (
              <Fact icon={MapPin} label="Where">
                {building}
              </Fact>
            )}
          </dl>

          {request.rewardDetail && (
            <section className="space-y-2">
              <h2 className={sideHeading}>What you get</h2>
              <p className="text-pretty break-words">{request.rewardDetail}</p>
            </section>
          )}

          {request.description && (
            <section className="space-y-2">
              <h2 className={sideHeading}>The ask</h2>
              <p className="text-pretty break-words whitespace-pre-line">{request.description}</p>
            </section>
          )}

          {request.skills.length > 0 && (
            <section className="space-y-2">
              <h2 className={sideHeading}>Skills</h2>
              <ul className="flex flex-wrap gap-1.5">
                {request.skills.map((skill) => (
                  <li key={skill} className="flex">
                    <Badge variant="outline">{skill}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="md:sticky md:top-6 md:self-start">
          <OfferPanel
            request={request}
            offer={offer}
            ready={offerReady}
            mine={request.createdBy === userId}
            onChange={reload}
          />
        </aside>
      </div>
    </Shell>
  );
}
