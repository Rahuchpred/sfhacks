import { cn } from "@/lib/utils";

// The 4-character pickup code, one tile per character so it is easy to read
// aloud. Screen readers get it spelled out.
export function PickupCode({
  code,
  size = "md",
  muted = false,
  className,
}: {
  code: string;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
  className?: string;
}) {
  const characters = code.toUpperCase().split("");

  return (
    <p
      role="img"
      aria-label={`Pickup code ${characters.join(" ")}`}
      className={cn("flex gap-1.5", size === "lg" && "gap-2", className)}
    >
      {characters.map((character, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            "flex items-center justify-center rounded-lg font-mono font-semibold tabular-nums",
            size === "sm" && "h-9 w-7 rounded-md text-lg",
            size === "md" && "h-14 w-11 text-3xl",
            size === "lg" && "h-20 w-16 rounded-xl text-5xl",
            muted
              ? "bg-muted text-muted-foreground line-through decoration-1"
              : "bg-accent text-accent-foreground",
          )}
        >
          {character}
        </span>
      ))}
    </p>
  );
}
