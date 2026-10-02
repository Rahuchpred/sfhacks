import { MessagesSquare } from "lucide-react";

// On a wide screen, the right pane before a conversation is picked. A phone shows the list instead.
export default function MessagesPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
        <MessagesSquare className="size-6 text-primary" aria-hidden />
      </div>
      <p className="text-sm text-muted-foreground">Pick a conversation</p>
    </div>
  );
}
