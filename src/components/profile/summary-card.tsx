"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, useUnsavedWarning } from "@/components/profile/profile-utils";
import { writeSummary } from "@/components/profile/summary-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveMyProfile } from "@/lib/db";
import type { Profile, TicketWithEvent } from "@/lib/types";

type Props = {
  profile: Profile | null;
  attended: TicketWithEvent[];
  onSaved: (profile: Profile) => void;
};

export function SummaryCard({ profile, attended, onSaved }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);

  useUnsavedWarning(draft !== null);

  const summary = profile?.aiSummary?.trim() || null;
  const hasName = Boolean(profile?.fullName.trim());
  const hasMaterial = attended.length > 0 || Boolean(profile?.bio.trim());
  const blocked = !hasName
    ? "Save your name first."
    : !hasMaterial
      ? "Nothing to write from yet. Attend an event or save a short bio first."
      : null;

  async function onWrite() {
    if (!profile || blocked) return;
    setWriting(true);
    try {
      setDraft(await writeSummary());
    } catch (error) {
      toast.error(errorMessage(error, "Could not write a summary. Try again."));
    } finally {
      setWriting(false);
    }
  }

  async function onSave() {
    if (!profile || draft === null) return;
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      const next = await saveMyProfile({ fullName: profile.fullName, aiSummary: text });
      setDraft(null);
      onSaved(next);
      toast.success("Summary saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the summary. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium text-balance">AI summary</h2>
        <CardDescription>
          A short paragraph written from your details and the events you showed up to.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {draft !== null ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-summary-draft">AI-written draft. Edit it before saving.</Label>
            <Textarea
              id="profile-summary-draft"
              name="aiSummary"
              autoComplete="off"
              rows={4}
              maxLength={600}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={saving}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onSave} disabled={saving || !draft.trim()}>
                {saving ? "Saving…" : "Save summary"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={saving}>
                Discard
              </Button>
            </div>
          </div>
        ) : (
          <>
            {summary ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm leading-relaxed break-words whitespace-pre-line text-pretty">
                  {summary}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="size-3" aria-hidden />
                  AI-written, edited by you
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No summary yet.</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button
                type="button"
                variant={summary ? "outline" : "default"}
                onClick={onWrite}
                disabled={writing || blocked !== null}
                aria-describedby={blocked ? "profile-summary-blocked" : undefined}
              >
                <Sparkles aria-hidden />
                {writing ? "Writing…" : summary ? "Write a new summary" : "Write my summary"}
              </Button>
              {blocked && (
                <p id="profile-summary-blocked" className="text-xs text-pretty text-muted-foreground">
                  {blocked}
                </p>
              )}
            </div>
          </>
        )}
        <p aria-live="polite" className="sr-only">
          {writing ? "Writing your summary…" : draft !== null ? "Draft ready to edit." : ""}
        </p>
      </CardContent>
    </Card>
  );
}
