// Mobbin reference: v0 sign up, one email field, then six single-digit boxes.
// https://mobbin.com/flows/b91dcea0-af15-4792-9361-c6d4a645a982
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CodeInput } from "@/components/onboarding/code-input";
import { sendCode, verifyCode, type CodeKind } from "@/components/onboarding/sign-in";
import { Field, fieldControlProps } from "@/components/post/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isEmail, isSfsuEmail, roleNeedsSfsuEmail } from "@/lib/roles";
import type { Role } from "@/lib/types";

const RESEND_SECONDS = 60;

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

type Props = {
  role: Role;
  // Demo emails are checked by our own route first, where that is turned on.
  demo: boolean;
  onSignedIn: () => Promise<void>;
};

export function EmailStep({ role, demo, onSignedIn }: Props) {
  const needsSfsu = roleNeedsSfsuEmail(role);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Set once a code is on its way: the step then shows the six boxes.
  const [sent, setSent] = useState<{ email: string; kind: CodeKind; at: number } | null>(null);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!sent) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sent]);

  // Instant checks. A demo email is the one case the server has to answer.
  function check(value: string): string | null {
    if (!isEmail(value)) return "Enter your email.";
    if (needsSfsu && !demo && !isSfsuEmail(value)) return "Use your SFSU email.";
    return null;
  }

  async function send(target: string) {
    setSending(true);
    try {
      const kind = await sendCode(target, { demo, needsSfsu });
      setSent({ email: target, kind, at: Date.now() });
      setNow(Date.now());
      setCode("");
      setCodeError(null);
    } catch (error) {
      setEmailError(message(error, "Could not send the code. Try again."));
      setSent(null);
    } finally {
      setSending(false);
    }
  }

  function onSubmitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = email.trim().toLowerCase();
    const problem = check(target);
    setEmailError(problem);
    if (problem) {
      document.getElementById("welcome-email")?.focus();
      return;
    }
    void send(target);
  }

  async function verify(full: string) {
    if (!sent || verifying) return;
    setVerifying(true);
    setCodeError(null);
    try {
      await verifyCode(sent.email, full, sent.kind);
      await onSignedIn();
    } catch (error) {
      setCodeError(message(error, "That code is wrong or expired."));
      setCode("");
      setVerifying(false);
    }
  }

  if (!sent) {
    const issues = emailError ? [{ message: emailError, severity: "error" as const }] : [];
    return (
      <form onSubmit={onSubmitEmail} noValidate className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Your email</h1>
        <Field id="welcome-email" label={needsSfsu ? "SFSU email" : "Work email"} issues={issues}>
          <Input
            {...fieldControlProps("welcome-email", issues)}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError(null);
            }}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            placeholder={needsSfsu ? "you@sfsu.edu" : "you@company.com"}
            className="h-10"
          />
        </Field>
        <Button type="submit" size="lg" className="h-10" disabled={sending}>
          {sending && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {sending ? "Sending" : "Send code"}
        </Button>
      </form>
    );
  }

  const wait = Math.max(0, RESEND_SECONDS - Math.floor((now - sent.at) / 1000));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 id="welcome-code-label" className="text-2xl font-semibold tracking-tight text-balance">
          Enter the code
        </h1>
        <p className="text-sm break-words text-muted-foreground">Sent to {sent.email}</p>
      </div>

      <div className="flex flex-col gap-2">
        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (codeError) setCodeError(null);
          }}
          onComplete={verify}
          labelledBy="welcome-code-label"
          describedBy="welcome-code-status"
          invalid={Boolean(codeError)}
          disabled={verifying}
        />
        <p
          id="welcome-code-status"
          aria-live="polite"
          className="flex min-h-5 items-center gap-1.5 text-sm text-muted-foreground"
        >
          {verifying && (
            <>
              <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
              Checking
            </>
          )}
          {codeError && <span className="font-medium text-destructive">{codeError}</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={wait > 0 || sending || verifying}
          onClick={() => send(sent.email)}
          className="-ml-2.5 tabular-nums"
        >
          {sending ? "Sending" : wait > 0 ? `Send again in ${wait}s` : "Send again"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={verifying}
          onClick={() => setSent(null)}
          className="-mr-2.5"
        >
          Change email
        </Button>
      </div>
    </div>
  );
}
