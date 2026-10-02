import type { Metadata } from "next";
import { FoodDesk } from "@/components/host/food-desk";

export const metadata: Metadata = { title: "Leftover food | Gator Radar" };

export default async function EventFoodPage({ params }: PageProps<"/host/[id]/food">) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <FoodDesk id={id} />
    </div>
  );
}
