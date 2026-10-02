import Link from "next/link";
import { CalendarPlus, ChartColumn, Users } from "lucide-react";
import { Dashboard } from "@/components/host/dashboard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Your events | Gator Radar" };

const ACTION = "h-10 px-4";

export default function HostPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="font-heading text-2xl font-semibold text-balance">Your events</h1>
        <nav aria-label="Organizer shortcuts" className="flex flex-wrap gap-2">
          <Link href="/post" className={cn(buttonVariants(), ACTION)}>
            <CalendarPlus aria-hidden="true" />
            Post an event
          </Link>
          <Link href="/host/clubs" className={cn(buttonVariants({ variant: "outline" }), ACTION)}>
            <Users aria-hidden="true" />
            My clubs
          </Link>
          <Link
            href="/host/analytics"
            className={cn(buttonVariants({ variant: "outline" }), ACTION)}
          >
            <ChartColumn aria-hidden="true" />
            Analytics
          </Link>
        </nav>
      </header>
      <Dashboard />
    </div>
  );
}
