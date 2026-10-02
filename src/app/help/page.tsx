import type { Metadata } from "next";
import { HelpBoard } from "@/components/help/help-board";

export const metadata: Metadata = { title: "Help board | Gator Radar" };

export default function HelpPage() {
  return <HelpBoard />;
}
