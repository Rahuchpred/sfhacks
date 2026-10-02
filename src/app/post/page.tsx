import type { Metadata } from "next";
import Link from "next/link";
import { Utensils } from "lucide-react";
import { PostEvent } from "@/components/post/post-event";

export const metadata: Metadata = { title: "Post an event | Gator Radar" };

// /post creates an event. Old /post?tab=food links land on a note that points to Host.
export default async function PostPage({ searchParams }: PageProps<"/post">) {
  const params = await searchParams;
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mx-auto mb-6 max-w-4xl text-2xl font-semibold tracking-tight text-balance">
        Post an event
      </h1>
      {tab === "food" && (
        <p className="mx-auto mb-6 flex max-w-4xl items-start gap-2 rounded-xl border border-accent/40 bg-accent/15 p-3 text-sm text-pretty text-accent-foreground">
          <Utensils className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Leftover food is now posted from your event&apos;s page.{" "}
            <Link
              href="/host"
              className="font-medium underline underline-offset-4 hover:no-underline"
            >
              Go to Host
            </Link>
          </span>
        </p>
      )}
      <PostEvent />
    </div>
  );
}
