"use client";

// Reference, from memory because the Mobbin tool was not connected in this
// session: the Intercom and Airbnb reply boxes, one growing text field with a
// round send button inside its right edge.

import { useId, useState } from "react";
import { ArrowUp } from "lucide-react";
import { MESSAGE_MAX_LENGTH } from "@/lib/db-messages";
import { cn } from "@/lib/utils";

// Enter sends, Shift+Enter adds a line. Sending never blocks typing the next one.
export function Composer({
  placeholder,
  onSend,
  maxLength = MESSAGE_MAX_LENGTH,
  autoFocus = false,
}: {
  placeholder: string;
  onSend: (body: string) => void;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const counterId = useId();
  const body = text.trim();
  const left = maxLength - text.length;

  function send() {
    if (!body) return;
    onSend(body);
    setText("");
  }

  return (
    <form
      className="shrink-0 border-t px-3 py-3 sm:px-5"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="flex items-end gap-2 rounded-2xl border bg-background py-1.5 pr-1.5 pl-3.5 transition-colors duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 motion-reduce:transition-none">
        <textarea
          rows={1}
          value={text}
          maxLength={maxLength}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={left <= 100 ? counterId : undefined}
          enterKeyHint="send"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter while picking a suggestion from an input method must not send.
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            send();
          }}
          className="field-sizing-content max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        {left <= 100 && (
          <span
            id={counterId}
            className={cn(
              "pb-1.5 text-xs tabular-nums",
              left === 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {left}
            <span className="sr-only"> characters left</span>
          </span>
        )}
        <button
          type="submit"
          disabled={!body}
          aria-label="Send"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[transform,opacity,background-color] duration-150 ease-out hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.94] disabled:opacity-40 motion-reduce:transition-none"
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </div>
    </form>
  );
}
