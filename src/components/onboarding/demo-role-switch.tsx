// Mobbin reference: Square's dashboard sidebar, a compact segmented control in
// the footer above the account row.
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { demoSetRole } from "@/lib/db";
import { ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHORT: Record<Role, string> = { student: "Student", faculty: "Faculty", recruiter: "Recruiter" };

// Only a demo account sees this. The switch really changes the role in the
// database, so every page and policy behaves as it would for that role.
export function DemoRoleSwitch() {
  const { role, isDemo, refreshProfile } = useAuth();
  const [pending, setPending] = useState<Role | null>(null);

  if (!isDemo) return null;

  async function choose(next: Role) {
    if (next === role || pending) return;
    setPending(next);
    try {
      await refreshProfile(await demoSetRole(next));
    } catch {
      toast.error("Could not switch role. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-1 px-1 pb-1 group-data-[collapsible=icon]:hidden">
      <span id="demo-role-label" className="px-1 text-xs font-medium text-sidebar-foreground/70">
        Demo role
      </span>
      <div
        role="group"
        aria-labelledby="demo-role-label"
        className="grid grid-cols-3 gap-0.5 rounded-lg bg-sidebar-accent p-0.5"
      >
        {ROLES.map((option) => {
          const active = (pending ?? role) === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              disabled={pending !== null}
              onClick={() => choose(option)}
              className={cn(
                "flex h-7 items-center justify-center gap-1 rounded-md text-xs font-medium outline-none",
                "transition-[background-color,color,scale] duration-150 ease-out motion-reduce:transition-none",
                "focus-visible:ring-2 focus-visible:ring-sidebar-ring active:scale-[0.97]",
                active
                  ? "bg-background text-foreground shadow-xs"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
              )}
            >
              {pending === option && (
                <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />
              )}
              {SHORT[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
