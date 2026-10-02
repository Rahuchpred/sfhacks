"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./footer.module.css";

// Mobbin reference: Cursor's marketing footer (brand on the left, a short row
// of links). The giant wordmark is the hover effect from the T3 Code redesign,
// rebuilt in SF State purple with a gold core: an outlined name, and a second
// copy on top filled with light around the pointer. Until the pointer moves,
// the light drifts on its own.

const LINKS = [
  { href: "/map", label: "Map" },
  { href: "/food", label: "Free food" },
  { href: "/clubs", label: "Clubs" },
  { href: "/post", label: "Post" },
];

export function Footer() {
  const giantRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const giant = giantRef.current;
    if (!giant) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Light position in the wordmark's own 0..1 space.
    let pointer: [number, number] | null = null;
    const at: [number, number] = [0.5, 0.45];
    let raf = 0;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = giant.getBoundingClientRect();
      pointer = [
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      ];
    };
    const tick = (now: number) => {
      const goal: [number, number] = pointer ?? [0.5 + Math.sin(now / 2000) * 0.42, 0.45];
      at[0] += (goal[0] - at[0]) * 0.07;
      at[1] += (goal[1] - at[1]) * 0.07;
      giant.style.setProperty("--gx", `${(at[0] * 100).toFixed(2)}%`);
      giant.style.setProperty("--gy", `${(at[1] * 100).toFixed(2)}%`);
      raf = requestAnimationFrame(tick);
    };

    // The loop only runs while the wordmark is on screen.
    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting) raf = requestAnimationFrame(tick);
    });
    observer.observe(giant);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <footer className="mt-auto overflow-hidden border-t">
      <div className="mx-auto w-full max-w-5xl px-5 pt-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
          <span className="flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary">
              <span aria-hidden className="size-2 rounded-full bg-accent" />
            </span>
            Gator Radar
          </span>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-7 gap-y-2">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-sm text-sm text-muted-foreground transition-colors duration-150 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">Built at SF Hacks for SF State.</p>

        <div ref={giantRef} className={styles.giant} aria-hidden translate="no">
          <span className={styles.line}>Gator Radar</span>
          <span className={styles.fill}>Gator Radar</span>
        </div>
      </div>
    </footer>
  );
}
