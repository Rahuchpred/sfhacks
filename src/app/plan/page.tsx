import type { Metadata } from "next";
import { Planner } from "@/components/planner/planner";

export const metadata: Metadata = { title: "Plan an event | Gator Radar" };

// /plan: say or type an event idea, get a forecast and up to three places and times.
export default function PlanPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight text-balance">
        Plan an event
      </h1>
      <Planner />
    </div>
  );
}
