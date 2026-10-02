"use client";

import { use } from "react";
import { Thread } from "@/components/messages/thread";

// One conversation, beside the inbox on a wide screen and alone on a phone.
export default function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = use(params);
  return <Thread key={id} id={id} />;
}
