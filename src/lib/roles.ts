// Roles and who may open which page. Pure code, shared by the sidebar, the page
// guard in the app shell and the onboarding. The database enforces the same
// rules for the data itself.
import type { ClubLevel, Role } from "@/lib/types";

export const ROLES: Role[] = ["student", "faculty", "recruiter", "safety"];

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  faculty: "Faculty or staff",
  recruiter: "Recruiter",
  safety: "Campus safety",
};

// Levels inside a club. The database enforces what each one may do.
export const CLUB_LEVEL_LABELS: Record<ClubLevel, string> = {
  owner: "Owner",
  organizer: "Organizer",
  member: "Member",
};

// Owners and organizers post and edit events and read the data. Members help at
// the door and with leftover food.
export function canOrganize(level: ClubLevel | null | undefined): boolean {
  return level === "owner" || level === "organizer";
}

// The level over an event: the level in its club, or owner of an event with no club.
export function eventLevel(
  event: { clubId: string | null },
  clubs: { id: string; role: ClubLevel }[],
): ClubLevel | null {
  if (!event.clubId) return "owner";
  return clubs.find((club) => club.id === event.clubId)?.role ?? null;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function isSfsuEmail(email: string): boolean {
  return /@(mail\.)?sfsu\.edu$/i.test(email.trim());
}

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Students and faculty sign in with an SFSU address. Recruiters use any email.
export function roleNeedsSfsuEmail(role: Role): boolean {
  return role !== "recruiter";
}

// Where each role lands after signing in.
export function roleHome(role: Role | null): string {
  if (role === "faculty") return "/help/mine";
  if (role === "recruiter") return "/recruiters";
  if (role === "safety") return "/safety/alerts";
  return "/map";
}

// "open": everyone, guests included. "account": any signed-in role.
export type Access = "open" | "account" | Role[];

const CLUB_ROLES: Role[] = ["student", "faculty"];

// First match wins, so the narrow paths come before their parents.
const RULES: [RegExp, Access][] = [
  [/^\/(welcome)?$/, "open"],
  [/^\/safety\/alerts(\/|$)/, ["safety"]],
  [/^\/(map|food|clubs|safety|events)(\/|$)/, "open"],
  [/^\/(profile|tickets)(\/|$)/, "account"],
  [/^\/help\/(new|mine)(\/|$)/, ["faculty"]],
  [/^\/faculty(\/|$)/, ["faculty"]],
  [/^\/help(\/|$)/, ["student", "faculty"]],
  [/^\/(host|post|plan)(\/|$)/, CLUB_ROLES],
  [/^\/recruiters(\/|$)/, ["recruiter"]],
];

export function pathAccess(pathname: string): Access {
  return RULES.find(([pattern]) => pattern.test(pathname))?.[1] ?? "open";
}

export function canVisit(pathname: string, role: Role | null): boolean {
  const access = pathAccess(pathname);
  if (access === "open") return true;
  if (!role) return false;
  return access === "account" || access.includes(role);
}

// Only same-site paths are followed after signing in.
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/welcome")) {
    return null;
  }
  return next;
}

// The onboarding link that returns to the page the visitor was on.
export function welcomeHref(next?: string | null): string {
  const target = safeNext(next);
  return target && target !== "/" ? `/welcome?next=${encodeURIComponent(target)}` : "/welcome";
}

// After signing in: back to where they were when the role may open it.
export function landingPath(role: Role, next?: string | null): string {
  const target = safeNext(next);
  return target && canVisit(target.split(/[?#]/)[0], role) ? target : roleHome(role);
}
