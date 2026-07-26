"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  getPreferences,
  setPreferences as persistPreferences,
  type Preferences,
} from "@/lib/storage";

interface PreferencesContextValue {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(() => getPreferences());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", prefs.mode);
    document.documentElement.setAttribute("data-texture", prefs.texture);
    document.documentElement.setAttribute("data-ink", prefs.ink);
    persistPreferences(prefs);
  }, [prefs]);

  const update = (patch: Partial<Preferences>) =>
    setPrefs((cur) => ({ ...cur, ...patch }));

  return (
    <PreferencesContext.Provider value={{ prefs, update }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
