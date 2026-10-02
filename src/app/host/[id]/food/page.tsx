import type { Metadata } from "next";
import { FoodDesk } from "@/components/host/food-desk";

export const metadata: Metadata = { title: "Leftover food | Gator Radar" };

export default async function EventFoodPage({
  params,
  searchParams,
}: PageProps<"/host/[id]/food">) {
  const { id } = await params;
  // "Post food" on the Leftover food page lands here with the form already open.
  const { post } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <FoodDesk id={id} startPosting={post === "1"} />
    </div>
  );
}
