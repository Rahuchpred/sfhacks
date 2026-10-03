"use client";

import { useEffect, useState } from "react";
import { Loader2, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getHostNotes, saveHostNotes } from "@/lib/db-notes";

// Notes the club keeps after an event. Only the club sees them, and the AI insights
// read them to suggest better food amounts next time.
export function EventNotes({ eventId }: { eventId: string }) {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHostNotes(eventId)
      .then((text) => {
        if (cancelled) return;
        setNote(text);
        setSaved(text);
      })
      .catch(() => {
        if (!cancelled) setSaved("");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function save() {
    setSaving(true);
    try {
      await saveHostNotes(eventId, note.trim());
      setSaved(note.trim());
      toast.success("Notes saved");
    } catch {
      toast.error("Could not save the notes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="notes-heading" className="flex flex-col gap-2.5">
      <h2 id="notes-heading" className="flex items-center gap-2 text-base font-semibold">
        <NotebookPen aria-hidden className="size-4" />
        Notes for next time
      </h2>
      <textarea
        aria-label="Notes for next time"
        rows={3}
        maxLength={1000}
        value={note}
        disabled={saved === null}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Bought 4 pizzas, 1 and a half left. Veggie ran out first."
        className="field-sizing-content min-h-20 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Only your club sees this. AI insights use it.</p>
        <Button size="sm" onClick={save} disabled={saving || saved === null || note.trim() === saved}>
          {saving && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
          Save notes
        </Button>
      </div>
    </section>
  );
}
