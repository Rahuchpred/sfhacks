import Link from "next/link";
import { Check, Utensils } from "lucide-react";

// Mobbin reference: Perplexity's welcome cards (a small UI visual on a tinted
// panel, then a title and one line). Layout follows the four-card grid on
// obsidian.md. Every visual is drawn from shapes, never a screenshot.

const FEATURES = [
  {
    href: "/map",
    title: "Live campus map",
    line: "Every event, pinned to its building.",
    visual: <MapVisual />,
  },
  {
    href: "/food",
    title: "Free leftover food",
    line: "Claim a portion, pick it up with a code.",
    visual: <FoodVisual />,
  },
  {
    href: "/tickets",
    title: "QR check-in",
    line: "Your ticket scans at the door.",
    visual: <QrVisual />,
  },
  {
    href: "/profile",
    title: "A profile that builds itself",
    line: "Each check-in adds to it.",
    visual: <ProfileVisual />,
  },
];

export function FeatureGrid() {
  return (
    <section
      aria-label="Features"
      className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8 sm:pb-32"
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <li key={feature.href}>
            <Link
              href={feature.href}
              className="group block overflow-hidden rounded-2xl border bg-card transition-[border-color,scale] duration-150 ease-out hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.99] motion-reduce:transition-none"
            >
              <div
                aria-hidden
                className="flex h-44 items-center justify-center overflow-hidden border-b bg-muted/60"
              >
                {feature.visual}
              </div>
              <div className="px-5 py-4">
                <h2 className="text-[0.9375rem] font-medium">{feature.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{feature.line}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Building blocks on a street grid, purple pins for events and one gold pin
// for food.
function MapVisual() {
  const buildings = [
    [18, 22, 64, 38],
    [104, 14, 46, 54],
    [176, 26, 70, 34],
    [30, 92, 52, 44],
    [112, 98, 78, 36],
    [216, 88, 40, 50],
  ];
  const pins = [
    [50, 41],
    [127, 41],
    [151, 116],
  ];
  return (
    <svg viewBox="0 0 280 160" className="h-full w-full max-w-sm">
      <g className="stroke-border" strokeWidth="6" strokeLinecap="round">
        <path d="M-10 76 H290" />
        <path d="M94 -10 V170" />
        <path d="M200 76 V170" />
      </g>
      {buildings.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="6" className="fill-border" />
      ))}
      {pins.map(([x, y]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="7"
          className="fill-primary stroke-background"
          strokeWidth="3"
        />
      ))}
      <circle
        cx="236"
        cy="113"
        r="7"
        className="origin-center fill-accent opacity-0 [transform-box:fill-box] motion-safe:group-hover:animate-ping motion-safe:group-hover:opacity-50"
      />
      <circle cx="236" cy="113" r="7" className="fill-accent stroke-background" strokeWidth="3" />
    </svg>
  );
}

// The pickup code a student gets after claiming a portion.
function FoodVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Utensils className="size-4" />
      </span>
      <div className="flex gap-1.5">
        {["K", "7", "Q", "M"].map((char) => (
          <span
            key={char}
            className="flex h-12 w-10 items-center justify-center rounded-lg border bg-background font-mono text-xl font-semibold"
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}

// A QR-like grid: three finder squares and a fixed scatter of modules.
const QR_ROWS = [
  "1111111010101",
  "1000001001101",
  "1011101011001",
  "1011101000111",
  "1011101010010",
  "1000001011011",
  "1111111010101",
  "0000000001100",
  "1101011110101",
  "0010110010011",
  "1110101101101",
  "0101100110010",
  "1011011011101",
];

function QrVisual() {
  return (
    <div className="relative">
      <svg
        viewBox="0 0 13 13"
        shapeRendering="crispEdges"
        className="size-28 rounded-xl border bg-background p-2.5"
      >
        {QR_ROWS.flatMap((row, y) =>
          [...row].map((cell, x) =>
            cell === "1" ? (
              <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" className="fill-foreground" />
            ) : null,
          ),
        )}
      </svg>
      <span className="absolute -right-2.5 -bottom-2.5 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-muted transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:transition-none">
        <Check className="size-4" strokeWidth={3} />
      </span>
    </div>
  );
}

// A profile card: an avatar, then one checked row per event attended.
function ProfileVisual() {
  const rows = ["w-24", "w-32", "w-20"];
  return (
    <div className="w-56 rounded-xl border bg-background p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="size-8 rounded-full bg-primary/15" />
        <span className="h-2 w-20 rounded-full bg-foreground/80" />
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map((width) => (
          <li key={width} className="flex items-center gap-2">
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
            <span className={`h-1.5 rounded-full bg-border ${width}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
