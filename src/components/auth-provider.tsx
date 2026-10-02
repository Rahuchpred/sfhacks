"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getMyProfile } from "@/lib/db";
import { welcomeHref } from "@/lib/roles";
import { supabase } from "@/lib/supabase/client";
import type { Profile, Role } from "@/lib/types";

type Auth = {
  user: User | null;
  // Null for guests, and for an account that has not picked a role yet.
  profile: Profile | null;
  role: Role | null;
  isDemo: boolean;
  // False until the session, and the profile of a signed-in account, are known.
  ready: boolean;
  // Use after a change made elsewhere, or pass the fresh profile to skip the read.
  refreshProfile: (profile?: Profile) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth>({
  user: null,
  profile: null,
  role: null,
  isDemo: false,
  ready: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

// An account is the same person until its id or email changes.
function accountKey(user: User | null): string | null {
  return user?.email ? `${user.id}:${user.email}` : null;
}

// Every visitor gets an anonymous session, so a guest can browse and their
// tickets and claims carry over when they sign in with an email at /welcome.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionKnown, setSessionKnown] = useState(false);
  const [loaded, setLoaded] = useState<{ key: string; profile: Profile | null } | null>(null);

  useEffect(() => {
    // A failed anonymous sign-in still counts as known: the visitor is a guest.
    const becomeGuest = () =>
      supabase.auth.signInAnonymously().finally(() => setSessionKnown(true));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session) setSessionKnown(true);
      // Supabase calls must not run inside this callback, so start after it.
      if (event === "SIGNED_OUT") setTimeout(becomeGuest, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) becomeGuest();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const key = accountKey(user);
  // Counts profile writes, so a slow read never replaces a newer profile.
  const writes = useRef(0);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const started = writes.current;
    getMyProfile()
      .catch(() => null)
      .then((profile) => {
        if (cancelled || writes.current !== started) return;
        writes.current += 1;
        setLoaded({ key, profile });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Reads the session itself: right after a sign-in the state above can lag.
  const refreshProfile = useCallback(async (fresh?: Profile) => {
    const { data } = await supabase.auth.getSession();
    const current = accountKey(data.session?.user ?? null);
    if (!current) return;
    const profile = fresh ?? (await getMyProfile().catch(() => null));
    writes.current += 1;
    setLoaded({ key: current, profile });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<Auth>(() => {
    const profile = key && loaded?.key === key ? loaded.profile : null;
    return {
      user,
      profile,
      role: profile?.role ?? null,
      isDemo: profile?.isDemo ?? false,
      ready: sessionKnown && (!key || loaded?.key === key),
      refreshProfile,
      signOut,
    };
  }, [user, key, loaded, sessionKnown, refreshProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useUser(): User | null {
  return useContext(AuthContext).user;
}

export function useAuth(): Auth {
  return useContext(AuthContext);
}

// For actions on the open pages that need an account, such as registering or
// claiming food. Returns true for a signed-in role. A guest is sent to the
// onboarding and comes back to the same page afterwards.
export function useRequireAccount(): () => boolean {
  const { role } = useContext(AuthContext);
  return useCallback(() => {
    if (role) return true;
    window.location.assign(welcomeHref(window.location.pathname + window.location.search));
    return false;
  }, [role]);
}
