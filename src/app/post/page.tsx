import type { Metadata } from "next";
import { PostTabs } from "@/components/post/post-tabs";

export const metadata: Metadata = { title: "Post | Gator Radar" };

// /post?tab=food opens straight on the leftover food flow.
export default async function PostPage({ searchParams }: PageProps<"/post">) {
  const { tab } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Post</h1>
      <p className="mt-1 mb-6 text-pretty text-muted-foreground">
        Share an event or leftover food. AI drafts it, you confirm it.
      </p>
      <PostTabs defaultTab={tab === "food" ? "food" : "event"} />
    </div>
  );
}
