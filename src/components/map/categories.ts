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

// `tint` is a pale tile with dark text of the same hue, for covers and labels in lists.
// Every pair is a 100 background under 800 text, which is above 7:1 contrast. Purple stays
// the brand and the pins, gold stays food and red stays safety, so no category uses those.
export type Category = { tag: string; label: string; icon: LucideIcon; tint: string };

// One icon and one tint per event tag. The first matching tag on an event is its main category.
export const CATEGORIES: Category[] = [
  { tag: "social", label: "Social", icon: PartyPopper, tint: "bg-pink-100 text-pink-800" },
  { tag: "cultural", label: "Cultural", icon: Globe, tint: "bg-orange-100 text-orange-800" },
  { tag: "academic", label: "Academic", icon: GraduationCap, tint: "bg-blue-100 text-blue-800" },
  { tag: "career", label: "Career", icon: Briefcase, tint: "bg-slate-200 text-slate-800" },
  { tag: "sports", label: "Sports", icon: Trophy, tint: "bg-lime-100 text-lime-800" },
  { tag: "arts", label: "Arts", icon: Palette, tint: "bg-fuchsia-100 text-fuchsia-800" },
  { tag: "wellness", label: "Wellness", icon: HeartPulse, tint: "bg-teal-100 text-teal-800" },
  { tag: "volunteer", label: "Volunteer", icon: HandHeart, tint: "bg-sky-100 text-sky-800" },
];

export const OTHER_CATEGORY: Category = {
  tag: "other",
  label: "Other",
  icon: CalendarDays,
  tint: "bg-stone-200 text-stone-800",
};

export function mainCategory(event: Pick<CampusEvent, "tags">): Category {
  for (const tag of event.tags) {
    const match = CATEGORIES.find((category) => category.tag === tag);
    if (match) return match;
  }
  return OTHER_CATEGORY;
}
