"use client";

import { useCampus } from "@/lib/use-campus";

// Placeholder: Thread C builds the Food Rescue list and claim flow here.
export default function FoodPage() {
  const { rescues, loading } = useCampus();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Free food</h1>
      <p className="mt-1 text-muted-foreground">
        {loading ? "Loading…" : `${rescues.length} open right now.`}
      </p>
    </div>
  );
}
