// Mobbin reference: v0 sign up, six single-digit boxes.
// https://mobbin.com/flows/b91dcea0-af15-4792-9361-c6d4a645a982
"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const CODE_LENGTH = 6;

type Props = {
  // The digits typed so far, at most six.
  value: string;
  onChange: (value: string) => void;
  // Called once with the full code, the moment the last digit lands.
  onComplete: (code: string) => void;
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
};

export function CodeInput({
  value,
  onChange,
  onComplete,
  labelledBy,
  describedBy,
  invalid,
  disabled,
}: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  // Fast typing and paste arrive before the next render, so the handlers read
  // the digits from here instead of from the props of the last render.
  const digits = useRef(value);
  useEffect(() => {
    digits.current = value;
  }, [value]);

  function update(next: string) {
    digits.current = next;
    onChange(next);
  }

  // The boxes are disabled while a code is checked, which drops focus. Put it
  // back on the first empty box when they come back, ready for another try.
  const filled = value.length;
  useEffect(() => {
    if (!disabled) boxes.current[Math.min(filled, CODE_LENGTH - 1)]?.focus();
    // Only when the boxes are enabled again, not on every digit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function focusBox(index: number) {
    boxes.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]?.focus();
  }

  // Typing, pasting and the phone's code autofill all arrive here.
  function onInput(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) {
      update(digits.current.slice(0, index));
      return;
    }
    const next = (digits.current.slice(0, index) + typed).slice(0, CODE_LENGTH);
    update(next);
    focusBox(next.length);
    if (next.length === CODE_LENGTH) onComplete(next);
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits.current[index] && index > 0) {
      event.preventDefault();
      update(digits.current.slice(0, index - 1));
      focusBox(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(Math.min(index + 1, digits.current.length));
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="flex justify-between gap-2"
    >
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            boxes.current[index] = node;
          }}
          value={value[index] ?? ""}
          onChange={(event) => onInput(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          // A filled box is replaced by the next key, and an empty one further
          // along hands focus back to the first empty box.
          onFocus={(event) => {
            if (index > digits.current.length) focusBox(digits.current.length);
            else event.target.select();
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={index === 0}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "size-12 min-w-0 rounded-lg border border-input bg-background text-center text-xl font-semibold tabular-nums caret-primary outline-none",
            "transition-[border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          )}
        />
      ))}
    </div>
  );
}
