import type { Metadata } from "next";
import { RescueGrid } from "@/components/food/rescue-grid";

export const metadata: Metadata = { title: "Free food | Gator Radar" };

export default function FoodPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Free food</h1>
      <p className="mt-1 mb-6 text-pretty text-muted-foreground">
        Leftovers from campus events. Claim a portion, then pick it up before the safe-until time.
      </p>
      <RescueGrid />
    </div>
  );
}
