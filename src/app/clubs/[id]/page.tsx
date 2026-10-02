import type { Metadata } from "next";
import { ClubView } from "@/components/clubs/club-view";

export const metadata: Metadata = { title: "Club | Gator Radar" };

// One club: its totals, then upcoming and past events.
export default async function ClubPage({ params }: PageProps<"/clubs/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <ClubView key={id} id={id} />
    </div>
  );
}
