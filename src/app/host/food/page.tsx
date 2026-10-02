import type { Metadata } from "next";
import { FoodBoard } from "@/components/host/food-board";

export const metadata: Metadata = { title: "Leftover food | Gator Radar" };

export default function HostFoodPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <FoodBoard />
    </div>
  );
}
