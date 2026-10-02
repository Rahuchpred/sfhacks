"use client";

// Reference: Microsoft Copilot voice mode (Mobbin, web): one round microphone
// control and a single "I'm listening" line, nothing else competing with it.
import { useEffect, useRef } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpeechStatus } from "./use-speech";

type MicButtonProps = {
  status: SpeechStatus;
  // Loudness right now, 0 to 1.
  level: React.RefObject<number>;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function MicButton({ status, level, disabled, onStart, onStop }: MicButtonProps) {
  const halo = useRef<HTMLSpanElement>(null);
  const listening = status === "listening";

  // The halo follows the voice. Written straight to the element, so talking
  // never re-renders the page.
  useEffect(() => {
    const element = halo.current;
    if (!listening || !element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let smooth = 0;
    const draw = () => {
      smooth += (level.current - smooth) * 0.25;
      element.style.transform = `scale(${1.12 + smooth * 0.55})`;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      element.style.transform = "";
    };
  }, [listening, level]);

  const Icon = status === "transcribing" ? Loader2 : listening ? Square : Mic;

  return (
    <span className="relative inline-flex">
      <span
        ref={halo}
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full bg-primary/20 transition-opacity duration-200",
          listening ? "opacity-100" : "opacity-0",
        )}
      />
      <button
        type="button"
        aria-label={listening ? "Stop listening" : "Talk"}
        aria-pressed={listening}
        disabled={disabled || status === "transcribing"}
        onClick={listening ? onStop : onStart}
        className="relative flex size-20 touch-manipulation items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-[scale,background-color,opacity] duration-150 ease-out outline-none hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-[0.96] disabled:opacity-60 motion-reduce:active:scale-100 sm:size-24"
      >
        <Icon
          className={cn(
            "size-8 sm:size-9",
            listening && "size-6 fill-current sm:size-7",
            status === "transcribing" && "animate-spin motion-reduce:animate-none",
          )}
          aria-hidden
        />
      </button>
    </span>
  );
}
