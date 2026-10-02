import {
  Briefcase,
  CalendarDays,
  Globe,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Palette,
  PartyPopper,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { CampusEvent } from "@/lib/types";

export type Category = { tag: string; label: string; icon: LucideIcon };

// One icon per event tag. The first matching tag on an event is its main category.
export const CATEGORIES: Category[] = [
  { tag: "social", label: "Social", icon: PartyPopper },
  { tag: "cultural", label: "Cultural", icon: Globe },
  { tag: "academic", label: "Academic", icon: GraduationCap },
  { tag: "career", label: "Career", icon: Briefcase },
  { tag: "sports", label: "Sports", icon: Trophy },
  { tag: "arts", label: "Arts", icon: Palette },
  { tag: "wellness", label: "Wellness", icon: HeartPulse },
  { tag: "volunteer", label: "Volunteer", icon: HandHeart },
];

export const OTHER_CATEGORY: Category = { tag: "other", label: "Other", icon: CalendarDays };

export function mainCategory(event: CampusEvent): Category {
  for (const tag of event.tags) {
    const match = CATEGORIES.find((category) => category.tag === tag);
    if (match) return match;
  }
  return OTHER_CATEGORY;
}
