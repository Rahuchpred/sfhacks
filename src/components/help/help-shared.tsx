import {
  Award,
  Briefcase,
  CircleDollarSign,
  GraduationCap,
  HeartHandshake,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HelpOfferStatus, RewardType } from "@/lib/types";
import { cn } from "@/lib/utils";

// Shared pieces for the help board, the request page and the profile list.

export const REWARD_LABELS: Record<RewardType, string> = {
  "course credit": "Course credit",
  "reference letter": "Reference letter",
  experience: "Experience",
  "volunteer hours": "Volunteer hours",
  paid: "Paid",
};

const REWARD_ICONS: Record<RewardType, LucideIcon> = {
  "course credit": GraduationCap,
  "reference letter": Award,
  experience: Briefcase,
  "volunteer hours": HeartHandshake,
  paid: CircleDollarSign,
};

// What the student gets, in gold so it is the first thing read on a card.
export function RewardBadge({ type, className }: { type: RewardType; className?: string }) {
  const Icon = REWARD_ICONS[type];
  return (
    <Badge className={cn("bg-accent text-accent-foreground", className)}>
      <Icon aria-hidden />
      {REWARD_LABELS[type]}
    </Badge>
  );
}

const STATUS_LABELS: Record<HelpOfferStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  done: "Done",
};

export function OfferStatusBadge({ status }: { status: HelpOfferStatus }) {
  return (
    <Badge
      variant={
        status === "accepted" || status === "done"
          ? "default"
          : status === "declined"
            ? "destructive"
            : "secondary"
      }
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function Spinner() {
  return <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />;
}

export function spotsLabel(spots: number): string {
  return `${spots} ${spots === 1 ? "spot" : "spots"}`;
}

export const helpDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
