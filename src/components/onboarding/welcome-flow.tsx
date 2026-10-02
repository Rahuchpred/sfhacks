// Mobbin reference: Tally onboarding, one narrow centered column, nothing else
// on the page. https://mobbin.com/flows/4ad8acc8-87b1-4bf6-9a97-58aff989c810
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { DetailsStep } from "@/components/onboarding/details-step";
import { EmailStep } from "@/components/onboarding/email-step";
import { RoleStep } from "@/components/onboarding/role-step";
import { demoSignInEnabled } from "@/components/onboarding/sign-in";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProfile, setMyRole } from "@/lib/db";
import { landingPath } from "@/lib/roles";
import type { Profile, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = "role" | "email" | "details";
const STEPS: Step[] = ["role", "email", "details"];

export function WelcomeFlow({ next }: { next: string | null }) {
  const router = useRouter();
  const { user, profile, role, ready, refreshProfile, signOut } = useAuth();
  // Null until the visitor moves: the first step then follows from the account.
  const [step, setStep] = useState<Step | null>(null);
  const [choice, setChoice] = useState<Role | null>(null);
  const [pending, setPending] = useState<Role | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    demoSignInEnabled().then((enabled) => {
      if (!cancelled) setDemo(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Someone who already finished has nothing to do here.
  const finished = ready && step === null && role !== null && Boolean(profile?.fullName.trim());
  useEffect(() => {
    if (finished && role) router.replace(landingPath(role, next));
  }, [finished, role, next, router]);

  const current: Step | null =
    step ?? (!ready || finished ? null : role ? "details" : "role");

  // Runs once the account has an email. The database locks the first role, so
  // an existing account keeps its own and skips the last step.
  async function claimRole(wanted: Role) {
    try {
      const before = await getMyProfile();
      const fresh = before?.role ? before : await setMyRole(wanted);
      await refreshProfile(fresh);
      if (before?.role && fresh.fullName.trim()) {
        router.replace(landingPath(before.role, next));
        return;
      }
      setStep("details");
    } catch (error) {
      const needsSfsu = error instanceof Error && error.message.includes("sfsu_email_required");
      toast.error(
        needsSfsu ? "Students and faculty need an SFSU email." : "Could not sign in. Try again.",
      );
      setStep("role");
    }
  }

  async function chooseRole(wanted: Role) {
    setChoice(wanted);
    if (!user?.email) {
      setStep("email");
      return;
    }
    // Already signed in with an email, so there is no code to ask for.
    setPending(wanted);
    await claimRole(wanted);
    setPending(null);
  }

  async function finish(saved: Profile) {
    await refreshProfile(saved);
    router.replace(landingPath(saved.role ?? role ?? "student", next));
  }

  const position = current ? STEPS.indexOf(current) : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex h-10 items-center gap-2.5 rounded-md px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary">
            <span className="size-2 rounded-full bg-accent" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight">Gator Radar</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[23rem] flex-1 flex-col px-4 pt-[8vh] pb-16 sm:pt-[14vh]">
        <div className="mb-8 flex h-8 items-center justify-between">
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((name, index) => (
              <span
                key={name}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out motion-reduce:transition-none",
                  index === position ? "w-6 bg-primary" : "w-1.5",
                  index < position && "bg-primary/40",
                  index > position && "bg-border",
                )}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Step {position + 1} of {STEPS.length}
          </p>
          {current === "email" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("role")}
              className="-mr-2"
            >
              <ArrowLeft aria-hidden />
              Back
            </Button>
          )}
        </div>

        {current === null && (
          <div className="flex flex-col gap-6" aria-busy="true">
            <p role="status" className="sr-only">
              Loading
            </p>
            <Skeleton className="h-8 w-40" />
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-[4.25rem] rounded-xl" />
              <Skeleton className="h-[4.25rem] rounded-xl" />
              <Skeleton className="h-[4.25rem] rounded-xl" />
            </div>
          </div>
        )}

        {current !== null && (
          <div
            key={current}
            className="animate-in duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            {current === "role" && (
              <div className="flex flex-col gap-4">
                <RoleStep pending={pending} onChoose={chooseRole} />
                {user?.email && (
                  <p className="flex flex-wrap items-center justify-center gap-x-1 text-center text-sm break-all text-muted-foreground">
                    {user.email}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => signOut()}
                      className="px-1"
                    >
                      Sign out
                    </Button>
                  </p>
                )}
              </div>
            )}
            {current === "email" && choice && (
              <EmailStep role={choice} demo={demo} onSignedIn={() => claimRole(choice)} />
            )}
            {current === "details" && role && (
              <DetailsStep role={role} profile={profile} onDone={finish} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
