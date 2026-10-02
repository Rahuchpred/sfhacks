import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeatureGrid } from "./feature-grid";
import { Footer } from "./footer";
import { LiveCount } from "./live-count";

// Mobbin reference: Cursor's marketing home (one left-aligned headline, one
// line, one dark button, then feature blocks) and Perplexity's welcome screen
// (cards with a small UI visual above a title and one line).

export function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <section className="mx-auto w-full max-w-5xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28 sm:pb-20 lg:pt-36">
        <LiveCount />
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
          See what&apos;s on at SF State.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground sm:text-xl">
          Every club event and free food drop, on one map.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link
            href="/map"
            className={cn(
              buttonVariants({ size: "lg" }),
              "group h-11 gap-2 rounded-full px-5 text-[0.9375rem] transition-[background-color,scale] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none",
            )}
          >
            Open the map
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
          <Link
            href="/post"
            className="rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Posting for a club?
          </Link>
        </div>
      </section>

      <FeatureGrid />

      <Footer />
    </div>
  );
}
