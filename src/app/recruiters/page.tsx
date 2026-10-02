import type { Metadata } from "next";
import { RecruiterSearch } from "@/components/recruiters/recruiter-search";

export const metadata: Metadata = { title: "Recruiters | Gator Radar" };

export default function RecruitersPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Find students who show up</h1>
      <p className="mt-1 max-w-2xl text-pretty text-muted-foreground">
        Search by what students actually attended. Every event here was scanned at the door, and you
        only see students who chose to be visible.
      </p>
      <RecruiterSearch />
    </div>
  );
}
