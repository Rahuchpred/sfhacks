import type { Metadata } from "next";
import { MessagesLayout } from "@/components/messages/messages-layout";

export const metadata: Metadata = { title: "Messages | Gator Radar" };

// The inbox stays on the left while a conversation opens on the right.
export default function Layout({ children }: LayoutProps<"/messages">) {
  return <MessagesLayout>{children}</MessagesLayout>;
}
