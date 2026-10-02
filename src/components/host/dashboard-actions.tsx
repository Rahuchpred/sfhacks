"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChartColumn, Users, Utensils } from "lucide-react";
import { useUser } from "@/components/auth-provider";
import { buttonVariants } from "@/components/ui/button";
import { listMyClubs } from "@/lib/db";
import { canOrganize } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ACTION = "h-10 px-4";
const APPEAR = "animate-in duration-200 ease-out fade-in-0 motion-reduce:animate-none";

// The shortcuts over the dashboard. Someone who is only a member of their clubs
// gets the food desk instead of posting and analytics.
export function DashboardActions() {
  const userId = useUser()?.id ?? null;
  // Null until the clubs are known, so nothing a member cannot use flashes by.
  const [organizes, setOrganizes] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listMyClubs()
      .then((clubs) => {
        if (!cancelled) {
          setOrganizes(clubs.length === 0 || clubs.some((club) => canOrganize(club.role)));
        }
      })
      // Without the list, show everything: the database still refuses what is not allowed.
      .catch(() => {
        if (!cancelled) setOrganizes(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <nav aria-label="Club shortcuts" className="flex min-h-10 flex-wrap gap-2">
      {organizes === true && (
        <Link href="/post" className={cn(buttonVariants(), ACTION, APPEAR)}>
          <CalendarPlus aria-hidden="true" />
          Post an event
        </Link>
      )}
      {organizes === false && (
        <Link
          href="/host/food"
          className={cn(
            buttonVariants(),
            ACTION,
            APPEAR,
            "bg-accent text-accent-foreground hover:bg-accent/80",
          )}
        >
          <Utensils aria-hidden="true" />
          Leftover food
        </Link>
      )}
      <Link href="/host/clubs" className={cn(buttonVariants({ variant: "outline" }), ACTION)}>
        <Users aria-hidden="true" />
        My clubs
      </Link>
      {organizes === true && (
        <Link
          href="/host/analytics"
          className={cn(buttonVariants({ variant: "outline" }), ACTION, APPEAR)}
        >
          <ChartColumn aria-hidden="true" />
          Analytics
        </Link>
      )}
    </nav>
  );
}
