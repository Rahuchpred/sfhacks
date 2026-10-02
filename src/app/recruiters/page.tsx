import type { Metadata } from "next";
import { RecruiterSearch } from "@/components/recruiters/recruiter-search";

export const metadata: Metadata = { title: "Recruiters | Gator Radar" };

export default function RecruitersPage() {
  return <RecruiterSearch />;
}
