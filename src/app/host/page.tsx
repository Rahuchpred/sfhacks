import { Dashboard } from "@/components/host/dashboard";

export const metadata = { title: "Your events | Gator Radar" };

export default function HostPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6 space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-balance">Your events</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          See who is coming, check guests in and manage what you posted.
        </p>
      </header>
      <Dashboard />
    </div>
  );
}
