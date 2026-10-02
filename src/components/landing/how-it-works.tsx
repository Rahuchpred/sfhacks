import Link from "next/link";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    title: "Register and get a ticket",
    body: "Pick an event on the map. Registering gives you a QR ticket.",
    href: "/map",
    link: "Find an event",
  },
  {
    title: "Get scanned at the door",
    body: "The club scans your ticket when you walk in. That is the check-in.",
    href: "/tickets",
    link: "Your tickets",
  },
  {
    title: "It lands on your profile",
    body: "Every check-in is saved to your profile. Recruiters only see it if you opt in.",
    href: "/profile",
    link: "Your profile",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="border-t bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2
          id="how-heading"
          className="text-2xl font-semibold tracking-tight text-balance lowercase sm:text-3xl"
        >
          How it works
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <li key={step.href} className="min-w-0 border-t-2 border-primary pt-4">
              <span className="text-sm font-semibold text-primary tabular-nums">
                {index + 1}
              </span>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-balance">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              <Link
                href={step.href}
                className="mt-3 inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {step.link}
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
