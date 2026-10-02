"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// One centered message: empty, not found and error screens share it.
export function ClubMessage({
  icon: Icon,
  title,
  body,
  alert,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  alert?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      role={alert ? "alert" : undefined}
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-balance">{title}</h2>
      {body && <p className="text-sm text-pretty break-words text-muted-foreground">{body}</p>}
      {children}
    </div>
  );
}

export function ClubError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <ClubMessage icon={TriangleAlert} title={title} body={message} alert>
      <Button
        variant="outline"
        size="lg"
        className="h-10 px-4"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await onRetry();
          setPending(false);
        }}
      >
        {pending && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
        {pending ? "Trying" : "Try again"}
      </Button>
    </ClubMessage>
  );
}

type Loaded<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

// Loads once on mount. `reload` resolves when the retry has finished.
// `load` must be stable: define it outside the component or memoize it.
export function useLoad<T>(load: () => Promise<T>): Loaded<T> & { reload: () => Promise<void> } {
  const [state, setState] = useState<Loaded<T>>({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState<{ count: number; done?: () => void }>({ count: 0 });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Check your connection.";
        if (!cancelled) setState({ status: "error", data: null, error: message });
      })
      .finally(() => attempt.done?.());
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const reload = () =>
    new Promise<void>((done) => setAttempt((current) => ({ count: current.count + 1, done })));

  return { ...state, reload };
}
