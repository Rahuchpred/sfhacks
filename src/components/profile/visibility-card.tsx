"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/profile/profile-utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { saveMyProfile } from "@/lib/db";
import type { Profile } from "@/lib/types";

type Props = {
  profile: Profile | null;
  onSaved: (profile: Profile) => void;
};

// One switch, off by default. Saved the moment it changes.
export function VisibilityCard({ profile, onSaved }: Props) {
  // The value being saved, shown right away. Null when nothing is in flight.
  const [pending, setPending] = useState<boolean | null>(null);

  const hasName = Boolean(profile?.fullName.trim());
  const visible = pending ?? profile?.recruiterVisible ?? false;

  async function onChange(next: boolean) {
    if (!profile || !hasName) return;
    setPending(next);
    try {
      onSaved(await saveMyProfile({ fullName: profile.fullName, recruiterVisible: next }));
      toast.success(next ? "Visible to recruiters" : "Hidden from recruiters");
    } catch (error) {
      // Dropping the pending value puts the switch back where it was.
      toast.error(errorMessage(error, "Could not change visibility. Try again."));
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium text-balance">
          Recruiter visibility
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span id="profile-visible-label" className="text-sm font-medium">
              Show my profile to recruiters
            </span>
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {visible ? "Visible to recruiters" : "Hidden from recruiters"}
            </span>
          </div>
          <Switch
            checked={visible}
            onCheckedChange={onChange}
            disabled={!hasName || pending !== null}
            aria-labelledby="profile-visible-label"
            aria-describedby="profile-visible-help"
          />
        </div>
        <div id="profile-visible-help" className="flex flex-col gap-2 text-xs text-pretty text-muted-foreground">
          {!hasName && (
            <p className="font-medium text-foreground">Save your name first to turn this on.</p>
          )}
          <p>Shares your details, summary and attended events.</p>
        </div>
      </CardContent>
    </Card>
  );
}
