import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AttendanceStats } from "@/components/profile/profile-utils";

// Real numbers only, counted from checked-in tickets.
export function StatsRow({ stats }: { stats: AttendanceStats }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Tile label="Events attended">
        <span className="text-2xl font-semibold tabular-nums">{stats.events}</span>
      </Tile>
      <Tile label="Clubs met">
        <span className="text-2xl font-semibold tabular-nums">{stats.clubs}</span>
      </Tile>
      <Tile label="Top tags" className="col-span-2 sm:col-span-1">
        {stats.topTags.length > 0 ? (
          <span className="flex flex-wrap gap-1.5 pt-1">
            {stats.topTags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">None yet</span>
        )}
      </Tile>
    </dl>
  );
}

function Tile({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10",
        className,
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
