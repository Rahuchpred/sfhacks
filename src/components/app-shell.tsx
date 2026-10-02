"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChartColumn,
  CircleUser,
  ClipboardList,
  FileSpreadsheet,
  HandHelping,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapIcon,
  MessageSquarePlus,
  PlusCircle,
  Search,
  ShieldAlert,
  Ticket,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { DemoRoleSwitch } from "@/components/onboarding/demo-role-switch";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyClubs } from "@/lib/db";
import { canVisit, pathAccess, roleHome, welcomeHref } from "@/lib/roles";
import type { Role } from "@/lib/types";

// Mobbin reference: Square dashboard sidebar (grouped sections with small
// labels, icon and label rows, account at the bottom).

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

// Open to everyone, signed in or not.
const EXPLORE: NavGroup = {
  label: "Explore",
  items: [
    { href: "/map", label: "Map", icon: MapIcon },
    { href: "/food", label: "Free food", icon: Utensils },
    { href: "/clubs", label: "Clubs", icon: Building2 },
    { href: "/safety", label: "Safety notices", icon: ShieldAlert },
  ],
};

const STUDENT: NavGroup = {
  label: "Student",
  items: [
    { href: "/tickets", label: "My tickets", icon: Ticket },
    { href: "/help", label: "Help board", icon: HandHelping, exact: true },
  ],
};

const FACULTY: NavGroup = {
  label: "Faculty and staff",
  items: [
    { href: "/help/new", label: "Ask for help", icon: MessageSquarePlus },
    { href: "/help/mine", label: "My requests", icon: ClipboardList },
  ],
};

const RECRUITER: NavGroup = {
  label: "Recruiter",
  items: [{ href: "/recruiters", label: "Find students", icon: Search }],
};

// For a student or faculty member who is in a club.
const CLUBS: NavGroup = {
  label: "For clubs",
  items: [
    { href: "/host", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/post", label: "Post an event", icon: PlusCircle },
    { href: "/host/clubs", label: "My clubs", icon: Users },
    { href: "/host/analytics", label: "Analytics", icon: ChartColumn },
    { href: "/host/reports", label: "Reports", icon: FileSpreadsheet },
  ],
};

// And for one who is not in a club yet.
const START_CLUB: NavGroup = {
  label: "For clubs",
  items: [{ href: "/host/clubs", label: "Start a club", icon: Users }],
};

const ALL_ITEMS = [EXPLORE, STUDENT, FACULTY, RECRUITER, CLUBS].flatMap((group) => group.items);

// inClub is null while the membership is still loading: the club group then waits.
function navGroups(role: Role | null, inClub: boolean | null): NavGroup[] {
  const groups = [EXPLORE];
  if (role === "student") groups.push(STUDENT);
  if (role === "faculty") groups.push(FACULTY);
  if ((role === "student" || role === "faculty") && inClub !== null) {
    groups.push(inClub ? CLUBS : START_CLUB);
  }
  if (role === "recruiter") groups.push(RECRUITER);
  return groups;
}

// Whether the account organizes or belongs to a club. Checked again on each
// page until it is true, so the group appears right after starting a club.
function useInClub(userId: string | null, role: Role | null, pathname: string): boolean | null {
  const [known, setKnown] = useState<{ userId: string; inClub: boolean } | null>(null);
  const eligible = role === "student" || role === "faculty";
  const inClub = eligible && known?.userId === userId ? known.inClub : null;
  const recheck = inClub ? "" : pathname;

  useEffect(() => {
    if (!eligible || !userId) return;
    let cancelled = false;
    listMyClubs()
      .then((clubs) => {
        if (!cancelled) setKnown({ userId, inClub: clubs.length > 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eligible, userId, recheck]);

  return inClub;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    // The dashboard also covers single event pages under /host/<id>, but not
    // the other /host sections that have their own rows.
    const claimed = ALL_ITEMS.some(
      (other) => other !== item && other.href.startsWith(item.href) && pathname.startsWith(other.href),
    );
    return pathname.startsWith(item.href) && !claimed;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Titles for pages that are not sidebar rows, or that sit under one.
const TITLES: [RegExp, string][] = [
  [/^\/profile/, "Profile"],
  [/^\/events\//, "Event"],
  [/^\/clubs\/[^/]+/, "Club"],
  [/^\/host\/[^/]+\/check-in/, "Check in"],
  [/^\/host\/[^/]+\/food/, "Leftover food"],
  [/^\/host\/reports(\/|$)/, "Reports"],
  [/^\/host\/(?!clubs|analytics|reports)[^/]+$/, "Manage event"],
  [/^\/help\/(?!new|mine)[^/]+/, "Help request"],
];

function pageTitle(pathname: string): string | null {
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}

// Collapsed to icons, a row shows the icon alone, centered, with no label sliver.
const ROW_CLASS =
  "h-10 gap-3 text-[0.9375rem] font-medium group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0";
const LABEL_CLASS = "group-data-[collapsible=icon]:hidden";
const APPEAR_CLASS = "animate-in duration-200 ease-out fade-in-0 motion-reduce:animate-none";
const ACTIVE_ROW_CLASS =
  "data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary/90 data-active:hover:text-primary-foreground";

function NavLinks({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup
          key={group.label}
          // The role groups arrive after the account loads: they fade in instead of popping.
          className={group === EXPLORE ? undefined : APPEAR_CLASS}
        >
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={item.label}
                    isActive={isActive(pathname, item)}
                    className={`${ROW_CLASS} ${ACTIVE_ROW_CLASS}`}
                    render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                  >
                    <item.icon aria-hidden className="size-[1.125rem]!" />
                    <span className={LABEL_CLASS}>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

// Guests get one clear way in. A signed-in account gets its profile, a way
// out, and the role switch when it is the demo account.
function AccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, ready, signOut } = useAuth();
  const { setOpenMobile } = useSidebar();
  const [leaving, setLeaving] = useState(false);

  if (!ready) return null;

  if (!role) {
    return (
      <SidebarMenu className={APPEAR_CLASS}>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="Sign in"
            className={`${ROW_CLASS} bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground`}
            render={<Link href={welcomeHref(pathname)} onClick={() => setOpenMobile(false)} />}
          >
            <LogIn aria-hidden className="size-[1.125rem]!" />
            <span className={LABEL_CLASS}>Sign in</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // Leave for an open page first, so the guard does not send the new guest to
  // the onboarding of the page they were on.
  async function leave() {
    setLeaving(true);
    if (pathAccess(pathname) !== "open") router.replace("/map");
    await signOut();
    setLeaving(false);
  }

  return (
    <>
      <DemoRoleSwitch />
      <SidebarMenu className={APPEAR_CLASS}>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="Profile"
            isActive={pathname.startsWith("/profile")}
            className={ROW_CLASS}
            render={<Link href="/profile" onClick={() => setOpenMobile(false)} />}
          >
            <CircleUser aria-hidden className="size-[1.125rem]!" />
            <span className={LABEL_CLASS}>Profile</span>
          </SidebarMenuButton>
          <SidebarMenuAction
            type="button"
            aria-label="Sign out"
            title="Sign out"
            disabled={leaving}
            onClick={leave}
            className="w-6 text-sidebar-foreground/70 disabled:opacity-50"
          >
            <LogOut aria-hidden />
          </SidebarMenuAction>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 md:py-10" aria-busy="true">
      <p role="status" className="sr-only">
        Loading
      </p>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, ready } = useAuth();
  const inClub = useInClub(user?.id ?? null, role, pathname);
  const current = ALL_ITEMS.find((item) => isActive(pathname, item));
  const title = pageTitle(pathname) ?? current?.label ?? "";

  // Pages are guarded here by path, so the pages themselves need no checks.
  // A guest goes to the onboarding and comes back. A signed-in account that
  // opens a page of another role goes to its own home page.
  const open = pathAccess(pathname) === "open";
  const allowed = open || (ready && canVisit(pathname, role));
  useEffect(() => {
    if (!ready || allowed) return;
    router.replace(role ? roleHome(role) : welcomeHref(pathname + window.location.search));
  }, [ready, allowed, role, pathname, router]);

  // The landing page and the onboarding run full width with no sidebar.
  if (pathname === "/" || pathname === "/welcome") {
    return <main className="h-dvh overflow-y-auto bg-background">{children}</main>;
  }

  return (
    <SidebarProvider className="h-dvh">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link
            href="/"
            className="flex h-10 items-center gap-2.5 rounded-md px-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary">
              <span className="size-2 rounded-full bg-accent" aria-hidden />
            </span>
            <span className="truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              Gator Radar
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <NavLinks groups={navGroups(role, inClub)} />
        </SidebarContent>

        <SidebarFooter>
          <AccountMenu />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-0 min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </header>
        <main className="relative min-h-0 flex-1 overflow-y-auto">
          {allowed ? children : <PageSkeleton />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
