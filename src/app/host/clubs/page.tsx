import type { Metadata } from "next";
import { ClubManager } from "@/components/host/club-manager";

export const metadata: Metadata = { title: "My clubs | Gator Radar" };

export default function HostClubsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-balance">My clubs</h1>
      </header>
      <ClubManager />
    </div>
  );
}
