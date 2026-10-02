import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Profile, Role } from "@shared/types";
import { getMyProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";

type Auth = {
  ready: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  role: Role | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [readySession, setReadySession] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    const becomeGuest = () => {
      supabase.auth.signInAnonymously().finally(() => setReadySession(true));
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (session) setReadySession(true);
      if (event === "SIGNED_OUT") setTimeout(becomeGuest, 0);
      if (!session?.user.email) {
        setProfile(null);
        setProfileReady(true);
      } else {
        setProfileReady(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) becomeGuest();
      else {
        setUserId(session.user.id);
        setEmail(session.user.email ?? null);
        setReadySession(true);
        if (!session.user.email) setProfileReady(true);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const current = data.session?.user;
    setUserId(current?.id ?? null);
    setEmail(current?.email ?? null);
    if (!current?.email) {
      setProfile(null);
      setProfileReady(true);
      return;
    }
    const next = await getMyProfile().catch(() => null);
    setProfile(next);
    setProfileReady(true);
  }, []);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    getMyProfile()
      .catch(() => null)
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setProfileReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [email, userId]);

  const signOut = useCallback(async () => {
    setProfile(null);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<Auth>(
    () => ({
      ready: readySession && (!email || profileReady),
      userId,
      email,
      profile,
      role: profile?.role ?? null,
      refreshProfile,
      signOut,
    }),
    [readySession, email, profileReady, userId, profile, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
