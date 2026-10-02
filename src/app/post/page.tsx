import type { Metadata } from "next";
import { PostTabs } from "@/components/post/post-tabs";

export const metadata: Metadata = { title: "Post | Gator Radar" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// /post?tab=event and /post?tab=food open a form directly. A finished event
// links here with ?tab=food&event=<id>&building=<id>&room=<room>.
export default async function PostPage({ searchParams }: PageProps<"/post">) {
  const params = await searchParams;
  const tab = one(params.tab);
  const eventId = one(params.event);
  const building = one(params.building);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mx-auto mb-6 max-w-2xl">
        <h1 id="post-kind" className="text-2xl font-semibold tracking-tight text-balance">
          What are you sharing?
        </h1>
        <p className="mt-1 text-pretty text-muted-foreground">
          AI drafts it, you confirm it. Nothing goes live until you press Publish.
        </p>
      </div>
      <PostTabs
        initialKind={tab === "food" || tab === "event" ? tab : null}
        foodPrefill={
          building
            ? {
                eventId: eventId && UUID.test(eventId) ? eventId : null,
                buildingId: building,
                room: one(params.room) ?? "",
              }
            : undefined
        }
      />
    </div>
  );
}
