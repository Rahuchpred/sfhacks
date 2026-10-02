import type { Metadata } from "next";
import { AlertDesk } from "@/components/safety/alert-desk";

export const metadata: Metadata = { title: "Post an alert | Gator Radar" };

// Campus safety staff only. The app shell guards the path, and the database the data.
export default function SafetyAlertsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Post an alert</h1>
      <p className="mt-1 mb-6 text-pretty text-muted-foreground">
        A red circle on the campus map, shown to everyone until it runs out or you clear it.
      </p>
      <AlertDesk />
    </div>
  );
}
