import type { Metadata } from "next";
import { Manage } from "@/components/host/manage";

export const metadata: Metadata = { title: "Manage event | Gator Radar" };

export default async function ManageEventPage({ params }: PageProps<"/host/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Manage id={id} />
    </div>
  );
}
