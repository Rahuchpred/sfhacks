"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, useUnsavedWarning } from "@/components/profile/profile-utils";
import { writeSummary } from "@/components/profile/summary-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { saveMyProfile } from "@/lib/db";
import type { Profile, TicketWithEvent } from "@/lib/types";

type Props = {
  profile: Profile | null;
  attended: TicketWithEvent[];
  onSaved: (profile: Profile) => void;
};

// The first summary writes itself, once per browser session, so a reload never re-runs the AI.
function autoKey(profileId: string) {
  return `gator-radar:summary-auto:${profileId}`;
}

function shouldAutoWrite(profile: Profile | null, attended: TicketWithEvent[]) {
  if (!profile || !profile.fullName.trim() || profile.aiSummary?.trim()) return false;
  if (attended.length === 0) return false;
  try {
    return sessionStorage.getItem(autoKey(profile.id)) === null;
  } catch {
    return false;
  }
}

export function SummaryCard({ profile, attended, onSaved }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  // What the AI returned for the open draft, to tell an edited draft from an untouched one.
  const [aiText, setAiText] = useState<string | null>(null);
  // The database stores only the text, so "edited" is known only for a save made in this visit.
  const [lastSave, setLastSave] = useState<{ text: string; edited: boolean } | null>(null);
  const [auto] = useState(() => shouldAutoWrite(profile, attended));
  const [writing, setWriting] = useState(auto);
  const [saving, setSaving] = useState(false);
  const autoStarted = useRef(false);

  // A draft the student asked for or changed is worth a warning. An untouched automatic one is not.
  useUnsavedWarning(draft !== null && !(auto && draft === aiText));

  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (!auto || !profileId || autoStarted.current) return;
    autoStarted.current = true;
    try {
      sessionStorage.setItem(autoKey(profileId), "1");
    } catch {
      // Without storage the ref above still stops a second run on this page.
    }
    writeSummary()
      .then(
        (text) => {
          setAiText(text);
          setDraft(text);
        },
        () => {
          // Quiet: the student did not ask for this. The button below still works.
        },
      )
      .finally(() => setWriting(false));
  }, [auto, profileId]);

  const summary = profile?.aiSummary?.trim() || null;
  const hasName = Boolean(profile?.fullName.trim());
  const hasMaterial = attended.length > 0 || Boolean(profile?.bio.trim());
  const blocked = !hasName ? "Save your name first" : !hasMaterial ? "Attend an event first" : null;
  const edited = lastSave !== null && lastSave.text === summary && lastSave.edited;

  async function onWrite() {
    if (!profile || blocked) return;
    setWriting(true);
    try {
      const text = await writeSummary();
      setAiText(text);
      setDraft(text);
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
      setLastSave({ text, edited: aiText === null || text !== aiText.trim() });
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
        <CardDescription>Written from the events you showed up to.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {draft !== null ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-summary-draft">AI-written draft</Label>
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
                  {edited ? "AI-written, edited by you" : "AI-written"}
                </p>
              </div>
            ) : writing ? (
              <div className="flex flex-col gap-2" aria-hidden>
                <Skeleton className="h-4 w-full motion-reduce:animate-none" />
                <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-3/5 motion-reduce:animate-none" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No summary yet</p>
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
