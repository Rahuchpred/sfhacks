import { redirect } from "next/navigation";

// Planning now lives at the top of the post page.
export default function PlanPage() {
  redirect("/post");
}
