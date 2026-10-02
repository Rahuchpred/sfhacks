"use client";

import { useCampus } from "@/lib/use-campus";
import { FeatureGrid } from "./feature-grid";
import { Footer } from "./footer";
import { Hero } from "./hero";

// Three sections: a full-screen hero, the features shown with real product
// pieces, and the footer. One live campus feed drives all of it.
export function Landing() {
  const campus = useCampus();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <Hero buildings={campus.buildings} events={campus.events} rescues={campus.rescues} />
      <FeatureGrid {...campus} />
      <Footer />
    </div>
  );
}
