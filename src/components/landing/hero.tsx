"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Palette, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampusEvent } from "@/lib/types";
import { BACKGROUNDS, DEFAULT_BACKGROUND, type BackgroundId } from "./backgrounds";
import { LiveCount } from "./live-count";

// Structure after tenseidesign.com: a full-screen hero with the text dead
// center, two buttons and quiet activity behind. The activity is a ready-made
// background (see backgrounds.tsx), picked with the design tool in the corner.

const STORAGE_KEY = "gator-radar:hero-background";
const SPEEDS = [
  { label: "Slow", value: 0.4 },
  { label: "Normal", value: 1 },
  { label: "Fast", value: 2 },
];
const STRENGTHS = [
  { label: "Soft", value: 0.45 },
  { label: "Medium", value: 0.75 },
  { label: "Strong", value: 1 },
];
const FADES = [
  { label: "Off", value: 0 },
  { label: "Light", value: 0.5 },
  { label: "Full", value: 1 },
];
const SOURCES = ["Paper Shaders", "React Bits", "Aceternity"] as const;

type Settings = { id: BackgroundId; speed: number; strength: number; fade: number };
const DEFAULTS: Settings = { id: DEFAULT_BACKGROUND, speed: 1, strength: 0.75, fade: 0.5 };

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Settings> | null;
    if (saved && BACKGROUNDS.some((background) => background.id === saved.id)) {
      return { ...DEFAULTS, ...saved };
    }
  } catch {
    // Unreadable storage just means the defaults.
  }
  return DEFAULTS;
}

// Landing-only button shape: 48px tall, 4px corners, 28px side padding.
const buttonClass =
  "inline-flex h-12 items-center justify-center rounded-[4px] px-7 text-base font-medium transition-[background-color,border-color,scale] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring active:scale-[0.97] motion-reduce:transition-none";

const chipClass = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
    active ? "bg-white text-[#1b1530]" : "bg-white/10 text-white/80 hover:bg-white/20",
  );

function Choice<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: number;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[0.6875rem] font-medium tracking-wide text-white/50 uppercase">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(chipClass(value === option.value), "text-center")}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type HeroProps = { events: CampusEvent[] };

export function Hero({ events }: HeroProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [toolOpen, setToolOpen] = useState(false);

  // Saved choices are read after mount so the server and first client render match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
  }, []);

  function update(changes: Partial<Settings>) {
    setSettings((current) => {
      const next = { ...current, ...changes };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The choice still applies for this visit.
      }
      return next;
    });
  }

  const background = BACKGROUNDS.find((item) => item.id === settings.id) ?? BACKGROUNDS[0];

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#1b1530] px-5 py-24 text-center text-white">
      <div
        aria-hidden
        key={background.id}
        className={cn(
          "absolute inset-0 motion-reduce:hidden",
          !background.interactive && "pointer-events-none",
        )}
        style={{ opacity: settings.strength }}
      >
        {background.render(settings.speed)}
      </div>
      {/* A soft fade behind the text so it stays readable over the background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: settings.fade,
          background:
            "radial-gradient(ellipse 46% 40% at center, #1b1530 0%, color-mix(in srgb, #1b1530 72%, transparent) 55%, transparent 100%)",
        }}
      />

      <p className="pointer-events-none absolute top-6 left-5 flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-tight sm:left-8">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary">
          <span aria-hidden className="size-2 rounded-full bg-accent" />
        </span>
        Gator Radar
      </p>

      <div className="pointer-events-none relative flex flex-col items-center">
        <LiveCount count={events.length} className="text-white/70" />
        <h1 className="mt-5 max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl">
          See what&apos;s on at SF State.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-pretty text-white/70 sm:text-xl">
          Every club event and free food drop, on one map.
        </p>
        <div className="pointer-events-auto mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/map"
            className={cn(buttonClass, "bg-accent text-accent-foreground hover:bg-[#dcaa14]")}
          >
            Open the map
          </Link>
          <Link
            href="/post"
            className={cn(
              buttonClass,
              "border border-white/25 bg-[#1b1530]/40 text-white hover:border-white/50 hover:bg-white/5",
            )}
          >
            Post an event
          </Link>
        </div>
      </div>

      {/* Design tool: try backgrounds live. The choice is saved in this browser. */}
      <div className="absolute right-4 bottom-4 z-10 text-left sm:right-6 sm:bottom-6">
        {toolOpen ? (
          <div className="w-72 space-y-3 rounded-xl border border-white/15 bg-[#120e22]/95 p-3.5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Hero background</p>
              <button
                type="button"
                aria-label="Close the background tool"
                onClick={() => setToolOpen(false)}
                className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
              {SOURCES.map((source) => (
                <fieldset key={source}>
                  <legend className="mb-1.5 text-[0.6875rem] font-medium tracking-wide text-white/50 uppercase">
                    {source}
                  </legend>
                  <div className="grid grid-cols-2 gap-1">
                    {BACKGROUNDS.filter((item) => item.source === source).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={item.id === background.id}
                        onClick={() => update({ id: item.id })}
                        className={chipClass(item.id === background.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>

            <Choice label="Speed" options={SPEEDS} value={settings.speed} onChange={(speed) => update({ speed })} />
            <Choice
              label="Strength"
              options={STRENGTHS}
              value={settings.strength}
              onChange={(strength) => update({ strength })}
            />
            <Choice label="Fade behind text" options={FADES} value={settings.fade} onChange={(fade) => update({ fade })} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setToolOpen(true)}
            className="flex h-10 items-center gap-2 rounded-full border border-white/20 bg-[#120e22]/80 px-3.5 text-sm font-medium text-white/85 shadow-lg backdrop-blur transition-colors hover:bg-[#120e22] focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <Palette className="size-4" aria-hidden />
            Background
          </button>
        )}
      </div>
    </section>
  );
}
