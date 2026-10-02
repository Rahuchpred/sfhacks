import type { Metadata } from "next";
import { RequestForm } from "@/components/help/request-form";

export const metadata: Metadata = { title: "Ask for help | Gator Radar" };

export default function NewHelpRequestPage() {
  return <RequestForm />;
}
