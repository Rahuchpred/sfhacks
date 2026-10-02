import type { Metadata } from "next";
import { ClubDirectory } from "@/components/clubs/club-directory";

export const metadata: Metadata = { title: "Clubs | Gator Radar" };

export default function ClubsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-balance">Clubs</h1>
      <ClubDirectory />
    </div>
  );
}
