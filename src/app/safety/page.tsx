import type { Metadata } from "next";
import { SafetyAlertList } from "@/components/safety/safety-alert-list";
import { SafetyNotices } from "@/components/safety/safety-notices";

export const metadata: Metadata = { title: "Safety notices | Gator Radar" };

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Safety notices</h1>
      <p className="mt-1 mb-6 text-pretty text-muted-foreground">
        Alerts from Campus safety and official notices from University Police, for awareness. This is
        not an emergency system.
      </p>
      <SafetyAlertList />
      <SafetyNotices />
    </div>
  );
}
