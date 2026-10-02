import type { Metadata } from "next";
import { ReportView } from "@/components/reports/report-view";

export const metadata: Metadata = { title: "Reports | Gator Radar" };

export default function ReportsPage() {
  return <ReportView />;
}
