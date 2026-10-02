// Mobbin reference: Notion "How do you want to use Notion?", three stacked
// cards with an icon, a title and one grey line.
// https://mobbin.com/screens/99396b7b-c21d-4cea-8956-4942c2b9aae6
"use client";

import Link from "next/link";
import { BriefcaseBusiness, GraduationCap, Loader2, School, type LucideIcon } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHOICES: { role: Role; icon: LucideIcon; line: string }[] = [
  { role: "student", icon: GraduationCap, line: "Events, free food, tickets" },
  { role: "faculty", icon: School, line: "Ask students for help" },
  { role: "recruiter", icon: BriefcaseBusiness, line: "Find students who show up" },
];

type Props = {
  // The choice being saved, for an account that is already signed in.
  pending: Role | null;
  onChoose: (role: Role) => void;
};

export function RoleStep({ pending, onChoose }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Who are you?</h1>

      <div className="flex flex-col gap-2.5">
        {CHOICES.map(({ role, icon: Icon, line }) => (
          <button
            key={role}
            type="button"
            disabled={pending !== null}
            onClick={() => onChoose(role)}
            className={cn(
              "group flex items-center gap-3.5 rounded-xl border bg-card p-3.5 text-left outline-none",
              "transition-[border-color,background-color,scale] duration-150 ease-out motion-reduce:transition-none",
              "[@media(hover:hover)]:hover:border-primary/50 [@media(hover:hover)]:hover:bg-primary/[0.03] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "active:scale-[0.98] disabled:pointer-events-none",
              pending !== null && pending !== role && "opacity-50",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {pending === role ? (
                <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Icon aria-hidden className="size-5" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.9375rem] font-medium">{ROLE_LABELS[role]}</span>
              <span className="text-sm text-muted-foreground">{line}</span>
            </span>
          </button>
        ))}
      </div>

      <Link
        href="/map"
        className="self-center rounded-md px-2 py-1 text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Just browsing
      </Link>
    </div>
  );
}
