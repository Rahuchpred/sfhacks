import { MessageCircleQuestion } from "lucide-react";
import type { EventIssue } from "@/lib/types";
import { IssueLine } from "./field";

type IssueListProps = {
  // Issues that do not belong to a single field on the form.
  issues: EventIssue[];
  questions: string[];
};

export function IssueList({ issues, questions }: IssueListProps) {
  if (issues.length === 0 && questions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/50 p-4">
      {issues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">Also check</h3>
          <ul className="flex flex-col gap-1">
            {issues.map((issue) => (
              <IssueLine key={`${issue.field}-${issue.message}`} issue={issue} />
            ))}
          </ul>
        </div>
      )}
      {questions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">Questions students may have</h3>
          <ul className="flex flex-col gap-1">
            {questions.map((question) => (
              <li key={question} className="flex items-start gap-1.5 text-sm text-pretty">
                <MessageCircleQuestion
                  className="mt-0.5 size-3.5 shrink-0 text-primary"
                  aria-hidden
                />
                {question}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Answer them in the description if you can. They do not block publishing.
          </p>
        </div>
      )}
    </div>
  );
}
