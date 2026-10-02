import type { Metadata } from "next";
import { AttendanceLookup } from "@/components/faculty/attendance-lookup";

export const metadata: Metadata = { title: "Event attendance | Gator Radar" };

// /faculty/attendance: pick a campus event, see who was checked in, match it to a class list.
export default function FacultyAttendancePage() {
  return <AttendanceLookup />;
}
