"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChartColumn,
  CircleUser,
  LayoutDashboard,
  MapIcon,
  PlusCircle,
  Search,
  Ticket,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

// Mobbin reference: Square's dashboard sidebar (grouped sections with small
// labels, icon and label rows, account at the bottom).

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "For students",
    items: [
      { href: "/map", label: "Map", icon: MapIcon },
      { href: "/food", label: "Free food", icon: Utensils },
      { href: "/clubs", label: "Clubs", icon: Building2 },
      { href: "/tickets", label: "My tickets", icon: Ticket },
    ],
  },
  {
    label: "For clubs",
    items: [
      { href: "/host", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/post", label: "Post an event", icon: PlusCircle },
      { href: "/host/clubs", label: "My clubs", icon: Users },
      { href: "/host/analytics", label: "Analytics", icon: ChartColumn },
    ],
  },
  {
    label: "For recruiters",
    items: [{ href: "/recruiters", label: "Find students", icon: Search }],
  },
];

const ALL_ITEMS = GROUPS.flatMap((group) => group.items);

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

function NavLinks() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <>
      {GROUPS.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={item.label}
                    isActive={isActive(pathname, item)}
                    className="h-10 gap-3 text-[0.9375rem] font-medium data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90 data-[active=true]:hover:text-primary-foreground"
                    render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                  >
                    <item.icon aria-hidden className="size-[1.125rem]!" />
                    <span>{item.label}</span>
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = ALL_ITEMS.find((item) => isActive(pathname, item));
  const title = current?.label ?? (pathname.startsWith("/profile") ? "Profile" : "");

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
          <NavLinks />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip="Profile"
                isActive={pathname.startsWith("/profile")}
                className="h-10 gap-3 text-[0.9375rem] font-medium"
                render={<Link href="/profile" />}
              >
                <CircleUser aria-hidden className="size-[1.125rem]!" />
                <span>Profile</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-0 min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </header>
        <main className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
