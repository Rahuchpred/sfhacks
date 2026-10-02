import { cn } from "@/lib/utils";

// Decorative radar: three rings made of borders and one gold dot, echoing the logo dot.
export function RadarRings({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none relative aspect-square", className)}>
      <span className="absolute inset-0 rounded-full border border-primary/10" />
      <span className="absolute inset-[17%] rounded-full border border-primary/15" />
      <span className="absolute inset-[34%] rounded-full border border-primary/20" />
      <span className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
      <span className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/60 motion-safe:animate-ping" />
      <span className="absolute top-[22%] left-[68%] size-2 rounded-full bg-primary/30" />
      <span className="absolute top-[70%] left-[26%] size-2 rounded-full bg-primary/20" />
    </div>
  );
}
