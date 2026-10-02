import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";

export type Persona = "student" | "faculty" | "club";

export const SAMPLE_TICKET_CODE = "ALEX26QR";

export const PEOPLE: Record<Persona, { name: string; line: string }> = {
  student: { name: "Alex Chen", line: "Student · Computer Science" },
  faculty: { name: "Dr. Priya Shah", line: "Faculty · Computer Science" },
  club: { name: "Jordan Lee", line: "Gator Coders · organizer" },
};

const STORAGE_KEY = "gator-sample-persona";

function isPersona(value: string | null | undefined): value is Persona {
  return value === "student" || value === "faculty" || value === "club";
}

function personaFromUrl(url: string | null | undefined): Persona | null {
  if (!url) return null;
  const query = /[?&]persona=(student|faculty|club)(?:[&#]|$)/.exec(url);
  if (query && isPersona(query[1])) return query[1];
  const path = /(?:^|[/])sample\/(student|faculty|club)(?:[/?#]|$)/.exec(url);
  if (path && isPersona(path[1])) return path[1];
  return null;
}

type SampleValue = {
  ready: boolean;
  persona: Persona | null;
  choose: (persona: Persona) => void;
  clear: () => void;
};

const SampleContext = createContext<SampleValue | null>(null);

async function writePersona(persona: Persona | null) {
  try {
    if (persona) await AsyncStorage.setItem(STORAGE_KEY, persona);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory choice still drives this launch.
  }
}

export function SampleProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const personaRef = useRef<Persona | null>(null);

  const apply = useCallback((next: Persona | null) => {
    personaRef.current = next;
    setPersona(next);
    void writePersona(next);
  }, []);

  useEffect(() => {
    let active = true;

    const takeUrl = (url: string | null) => {
      const next = personaFromUrl(url);
      if (!next || !active) return;
      apply(next);
    };

    const subscription = Linking.addEventListener("url", (event) => {
      takeUrl(event.url);
    });

    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
      Linking.getInitialURL().catch(() => null),
    ]).then(([stored, initial]) => {
      if (!active) return;
      if (!personaRef.current) {
        const fromLaunch = personaFromUrl(initial);
        if (fromLaunch) apply(fromLaunch);
        else if (isPersona(stored)) {
          personaRef.current = stored;
          setPersona(stored);
        }
      }
      setReady(true);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [apply]);

  const choose = useCallback(
    (next: Persona) => {
      apply(next);
    },
    [apply],
  );

  const clear = useCallback(() => {
    apply(null);
  }, [apply]);

  const value = useMemo(
    () => ({ ready, persona, choose, clear }),
    [ready, persona, choose, clear],
  );

  return <SampleContext.Provider value={value}>{children}</SampleContext.Provider>;
}

export function useSample(): SampleValue {
  const value = useContext(SampleContext);
  if (!value) throw new Error("useSample must be used inside SampleProvider");
  return value;
}
