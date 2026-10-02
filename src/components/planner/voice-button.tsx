"use client";

// A small microphone for a text box. Speech is written into the box on this device and is
// never sent by itself: the person reads it, fixes it, then submits.
import { useRef } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeech } from "./use-speech";

type VoiceButtonProps = {
  // The text in the box right now. Speech is added after it.
  value: string;
  onChange: (text: string) => void;
  // Called when the final words are in the box, for example to focus it.
  onDone?: () => void;
  disabled?: boolean;
  className?: string;
};

export function VoiceButton({ value, onChange, onDone, disabled, className }: VoiceButtonProps) {
  const before = useRef("");
  const join = (spoken: string) => [before.current, spoken].filter(Boolean).join(" ");

  const speech = useSpeech({
    onLive: (spoken) => onChange(join(spoken)),
    onDone: (spoken) => {
      if (spoken) onChange(join(spoken));
      onDone?.();
    },
  });

  const listening = speech.status === "listening";
  const writing = speech.status === "transcribing";
  const loading = speech.download !== null;
  const percent = Math.round((speech.download ?? 0) * 100);
  const label = speech.error
    ? speech.error
    : loading
      ? `Getting the speech model, ${percent}%`
      : listening
        ? "Stop listening"
        : writing
          ? "Writing it down"
          : "Talk instead of typing";
  const Icon = writing ? Loader2 : listening ? Square : Mic;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={listening}
        disabled={disabled || writing}
        onClick={() => {
          if (listening) {
            speech.stop();
            return;
          }
          before.current = value.trim();
          speech.start();
        }}
        className={cn(
          "flex size-10 touch-manipulation items-center justify-center rounded-full border transition-[background-color,border-color,color,scale] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:opacity-60 motion-reduce:transition-none",
          listening
            ? "border-primary bg-primary/10 text-primary"
            : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
          speech.error && "border-destructive/50 text-destructive",
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            "size-4",
            listening && "size-3.5 fill-current",
            writing && "animate-spin motion-reduce:animate-none",
          )}
        />
      </button>
      <span role="status" className="sr-only">
        {listening ? "Listening" : writing ? "Writing it down" : (speech.error ?? "")}
      </span>
      {(loading || speech.error) && (
        <span className="pointer-events-none absolute right-0 bottom-full mb-1.5 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm">
          {speech.error ?? `Speech model, one time: ${percent}%`}
        </span>
      )}
    </span>
  );
}
