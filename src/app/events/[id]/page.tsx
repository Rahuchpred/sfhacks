"use client";

import { use } from "react";
import { EventView } from "@/components/events/event-view";

// One event: cover and host on the left, details and registration on the right.
export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EventView key={id} id={id} />;
}
