import { Dashboard } from "@/components/host/dashboard";
import { DashboardActions } from "@/components/host/dashboard-actions";

export const metadata = { title: "Your events | Gator Radar" };

export default function HostPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="font-heading text-2xl font-semibold text-balance">Your events</h1>
        <DashboardActions />
      </header>
      <Dashboard />
    </div>
  );
}
