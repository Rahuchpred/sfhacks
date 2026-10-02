"use client";

import { use } from "react";
import { HelpDetail } from "@/components/help/help-detail";

// One help request: the ask on the left, the offer panel on the right.
export default function HelpRequestPage({ params }: PageProps<"/help/[id]">) {
  const { id } = use(params);
  return <HelpDetail key={id} id={id} />;
}
