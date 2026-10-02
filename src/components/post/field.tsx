import { CircleAlert, TriangleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { EventIssue } from "@/lib/types";

// Native select styled to match the shadcn Input.
export const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 py-1 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm";

type FieldIssue = Pick<EventIssue, "message" | "severity">;

// Props to spread on the control so it is tied to its label and messages.
export function fieldControlProps(id: string, issues: FieldIssue[] = []) {
  return {
    id,
    "aria-invalid": issues.some((issue) => issue.severity === "error") || undefined,
    "aria-describedby": issues.length > 0 ? `${id}-issues` : undefined,
  };
}

type FieldProps = {
  id: string;
  label: string;
  optional?: boolean;
  needsInput?: boolean;
  issues?: FieldIssue[];
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

export function Field({
  id,
  label,
  optional,
  needsInput,
  issues = [],
  hint,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-xs text-muted-foreground">Optional</span>}
        {needsInput && (
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">
            Needs input
          </span>
        )}
      </div>
      {children}
      {hint && issues.length === 0 && (
        <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
      )}
      {issues.length > 0 && (
        <ul id={`${id}-issues`} className="flex flex-col gap-1">
          {issues.map((issue) => (
            <IssueLine key={issue.message} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function IssueLine({ issue }: { issue: FieldIssue }) {
  const isError = issue.severity === "error";
  const Icon = isError ? CircleAlert : TriangleAlert;
  return (
    <li
      className={cn(
        "flex items-start gap-1.5 text-xs text-pretty",
        isError ? "font-medium text-destructive" : "text-foreground",
      )}
    >
      <Icon className={cn("mt-px size-3.5 shrink-0", !isError && "text-accent")} aria-hidden />
      <span>
        <span className="sr-only">{isError ? "Error: " : "Warning: "}</span>
        {issue.message}
      </span>
    </li>
  );
}
