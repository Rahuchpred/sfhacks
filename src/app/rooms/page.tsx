import type { Metadata } from "next";
import { RoomFinder } from "@/components/rooms/room-finder";

export const metadata: Metadata = { title: "Free rooms | Gator Radar" };

export default function RoomsPage() {
  return <RoomFinder />;
}
