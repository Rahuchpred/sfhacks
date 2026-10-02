import type { Metadata } from "next";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { safeNext } from "@/lib/roles";

export const metadata: Metadata = { title: "Sign in | Gator Radar" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { next } = await searchParams;
  return <WelcomeFlow next={safeNext(typeof next === "string" ? next : null)} />;
}
