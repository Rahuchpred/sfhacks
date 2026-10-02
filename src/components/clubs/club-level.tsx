"use client";

// Mobbin reference: Vercel, team members (a small role badge next to each name).
import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CLUB_LEVEL_LABELS } from "@/lib/roles";
import type { ClubLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const CLUBS_CHANGED = "gator:clubs-changed";

// Call after creating or joining a club, or changing a level, so the sidebar
// follows without a reload.
export function notifyClubsChanged() {
  window.dispatchEvent(new Event(CLUBS_CHANGED));
}

export function onClubsChanged(listener: () => void): () => void {
  window.addEventListener(CLUBS_CHANGED, listener);
  return () => window.removeEventListener(CLUBS_CHANGED, listener);
}

const LEVEL_CLASS: Record<ClubLevel, string> = {
  owner: "bg-primary text-primary-foreground",
  organizer: "bg-primary/10 text-primary",
  member: "bg-muted text-muted-foreground",
};

// Says which view of a club you are in.
export function LevelBadge({ level, className }: { level: ClubLevel; className?: string }) {
  return (
    <Badge className={cn("shrink-0", LEVEL_CLASS[level], className)}>
      {CLUB_LEVEL_LABELS[level]}
    </Badge>
  );
}

// For a club member who opens a page that is for the owner and organizers.
export function OrganizersOnly({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Lock aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Organizers only</h1>
      <p className="text-sm text-pretty text-muted-foreground">
        {title} is for the club owner and organizers.
      </p>
      <Link href="/host" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}>
        Back to dashboard
      </Link>
    </div>
  );
}
