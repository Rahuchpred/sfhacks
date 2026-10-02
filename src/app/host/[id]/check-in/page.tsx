import type { Metadata } from "next";
import { CheckIn } from "@/components/host/check-in";

export const metadata: Metadata = { title: "Check in | Gator Radar" };

export default async function CheckInPage({ params }: PageProps<"/host/[id]/check-in">) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
      <CheckIn id={id} />
    </div>
  );
}
