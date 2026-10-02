import type { Metadata } from "next";
import { MyRequests } from "@/components/help/my-requests";

export const metadata: Metadata = { title: "My requests | Gator Radar" };

export default function MyHelpRequestsPage() {
  return <MyRequests />;
}
