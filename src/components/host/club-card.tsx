"use client";

// Mobbin reference: Bloom, team settings (members list with a role badge on each row).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChartColumn, Check, Copy, Loader2, TriangleAlert, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { LevelBadge } from "@/components/clubs/club-level";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CLUB_LEVEL_LABELS, canOrganize } from "@/lib/roles";
import type { ClubLevel, ClubMember, MyClub } from "@/lib/types";
import { cn } from "@/lib/utils";

const COPIED_MS = 2000;
// A big club shows its first people, the rest sit behind "Show all".
const ROSTER_PREVIEW = 8;
type AssignableLevel = Exclude<ClubLevel, "owner">;

// Null while loading, "error" when the list could not be read.
export type ClubRoster = ClubMember[] | "error" | null;

export type ClubCardProps = {
  club: MyClub;
  roster: ClubRoster;
  myId: string | null;
  // True for a club created or joined a moment ago.
  fresh: boolean;
  onRetryRoster: () => void;
  // Owner only: both resolve once the roster has been read again.
  onSetLevel: (member: ClubMember, level: AssignableLevel) => Promise<void>;
  // Resolves true when the person was removed.
  onRemove: (member: ClubMember) => Promise<boolean>;
};

// "Ana Lima" gives "AL", a single word gives its first letter.
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
}

// The clipboard API is missing on plain http (a phone on the local network), so fall
// back to copying from a hidden field.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    field.remove();
    return copied;
  }
}

function CopyCode({ code, clubName }: { code: string; clubName: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    if (!(await copyText(code))) {
      toast.error(`Could not copy. The code is ${code}.`);
      return;
    }
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <Button
      variant="outline"
      className="h-10 min-w-26 px-4"
      aria-label={`Copy the join code for ${clubName}`}
      onClick={copy}
    >
      {/* Both labels share one grid cell, so the button keeps its width while they cross-fade. */}
      <span className="grid place-items-center">
        {[false, true].map((done) => {
          const Icon = done ? Check : Copy;
          return (
            <span
              key={String(done)}
              aria-hidden={copied !== done}
              className={cn(
                "col-start-1 row-start-1 inline-flex items-center gap-1.5 transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                copied === done
                  ? "scale-100 opacity-100 blur-none"
                  : "scale-90 opacity-0 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none",
              )}
            >
              <Icon aria-hidden="true" className={cn("size-4", done && "text-primary")} />
              {done ? "Copied" : "Copy"}
            </span>
          );
        })}
      </span>
      <span role="status" className="sr-only">
        {copied ? "Join code copied" : ""}
      </span>
    </Button>
  );
}

export function ClubCard({
  club,
  roster,
  myId,
  fresh,
  onRetryRoster,
  onSetLevel,
  onRemove,
}: ClubCardProps) {
  const headingId = `club-${club.id}`;
  const isOwner = club.role === "owner";
  const organizes = canOrganize(club.role);
  const [showAll, setShowAll] = useState(false);
  // The person whose level is being saved, and the one about to be removed.
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ClubMember | null>(null);
  const [removePending, setRemovePending] = useState(false);

  const changeLevel = async (member: ClubMember, level: AssignableLevel) => {
    if (savingId || level === member.role) return;
    setSavingId(member.uid);
    await onSetLevel(member, level);
    setSavingId(null);
  };

  const confirmRemove = async () => {
    if (!removing || removePending) return;
    setRemovePending(true);
    const removed = await onRemove(removing);
    setRemovePending(false);
    if (removed) setRemoving(null);
  };

  const people = Array.isArray(roster) ? roster : [];
  const shown = showAll ? people : people.slice(0, ROSTER_PREVIEW);

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 transition-[opacity,translate,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0",
        fresh && "shadow-md ring-primary/40",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 sm:p-5">
        <h3
          id={headingId}
          className="min-w-0 font-heading text-lg leading-snug font-medium break-words"
        >
          {club.name}
        </h3>
        <LevelBadge level={club.role} />
        <div className="-mx-3 flex flex-wrap gap-1 sm:mr-0 sm:ml-auto">
          <Link
            href={`/clubs/${club.id}`}
            aria-label={`Public page for ${club.name}`}
            className={cn(buttonVariants({ variant: "ghost" }), "h-9 px-3")}
          >
            Public page
            <ArrowUpRight aria-hidden="true" />
          </Link>
          {organizes && (
            <Link
              href="/host/analytics"
              aria-label={`Analytics for ${club.name}`}
              className={cn(buttonVariants({ variant: "ghost" }), "h-9 px-3")}
            >
              <ChartColumn aria-hidden="true" />
              Analytics
            </Link>
          )}
        </div>
      </header>

      <div
        className={cn(
          "grid border-t border-foreground/10",
          organizes && "sm:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]",
        )}
      >
        {/* Only the owner and organizers invite people. */}
        {organizes && (
          <div className="space-y-2 p-4 sm:p-5">
            <p className="text-muted-foreground">Join code</p>
            {club.joinCode ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-3xl font-semibold tracking-[0.2em] tabular-nums select-all">
                  {club.joinCode}
                </p>
                <CopyCode code={club.joinCode} clubName={club.name} />
              </div>
            ) : (
              <p className="text-muted-foreground">No code yet. Reload the page.</p>
            )}
            <p className="text-xs text-muted-foreground">New people join as members.</p>
          </div>
        )}

        <div
          className={cn(
            "space-y-2 p-4 sm:p-5",
            organizes && "border-t border-foreground/10 sm:border-t-0 sm:border-l",
          )}
        >
          <p className="text-muted-foreground">
            People
            {Array.isArray(roster) && <span className="tabular-nums"> · {roster.length}</span>}
          </p>
          {roster === null ? (
            <div aria-busy="true" className="space-y-2">
              <p role="status" className="sr-only">
                Loading people
              </p>
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-full motion-reduce:animate-none" />
                  <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          ) : roster === "error" ? (
            <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="flex items-center gap-1.5">
                <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />
                Could not load the people.
              </p>
              <Button variant="outline" className="h-9 px-3" onClick={onRetryRoster}>
                Try again
              </Button>
            </div>
          ) : roster.length === 0 ? (
            <p className="text-muted-foreground">Nobody listed.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {shown.map((member) => {
                  const editable = isOwner && member.role !== "owner";
                  return (
                    <li key={member.uid} className="flex min-h-9 min-w-0 items-center gap-2.5">
                      <Avatar>
                        <AvatarFallback className="text-xs font-medium">
                          {initials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate font-medium">{member.name}</span>
                      {member.uid === myId && <span className="text-muted-foreground">You</span>}
                      {editable ? (
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          {savingId === member.uid && (
                            <Loader2
                              aria-hidden="true"
                              className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
                            />
                          )}
                          <Select
                            value={member.role}
                            disabled={savingId !== null}
                            onValueChange={(value) =>
                              void changeLevel(member, value as AssignableLevel)
                            }
                          >
                            <SelectTrigger
                              aria-label={`Level of ${member.name}`}
                              className="h-9 min-w-30"
                            >
                              <SelectValue>{CLUB_LEVEL_LABELS[member.role]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="organizer">Organizer</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${member.name} from ${club.name}`}
                            title="Remove"
                            disabled={savingId !== null}
                            onClick={() => setRemoving(member)}
                          >
                            <UserMinus aria-hidden="true" />
                          </Button>
                        </span>
                      ) : (
                        <span className="ml-auto shrink-0 text-muted-foreground">
                          {CLUB_LEVEL_LABELS[member.role]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {people.length > ROSTER_PREVIEW && (
                <Button
                  variant="ghost"
                  className="-ml-3 h-9 px-3 text-muted-foreground"
                  aria-expanded={showAll}
                  onClick={() => setShowAll((current) => !current)}
                >
                  {showAll ? "Show fewer" : `Show all ${people.length}`}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next && !removePending) setRemoving(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription className="text-pretty">
              They lose access to {club.name} and its events. They can join again with the code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              className="h-10 px-4"
              disabled={removePending}
              onClick={() => setRemoving(null)}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="h-10 px-4"
              disabled={removePending}
              onClick={confirmRemove}
            >
              {removePending && (
                <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              )}
              <span aria-live="polite">{removePending ? "Removing…" : "Remove"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
