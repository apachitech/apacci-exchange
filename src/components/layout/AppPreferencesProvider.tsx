"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

interface AppPreferencesContextValue {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: (typeof dictionaries)[Locale];
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedLoc = localStorage.getItem("apacci_locale") as Locale | null;
    if (savedLoc === "fr" || savedLoc === "en") {
      setLocaleState(savedLoc);
    }
    const savedTheme = localStorage.getItem("apacci_theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme ?? (prefersDark ? "dark" : "light");
    setThemeState(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const setLocale = (loc: Locale) => {
    setLocaleState(loc);
    localStorage.setItem("apacci_locale", loc);
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setThemeState(next);
    localStorage.setItem("apacci_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <AppPreferencesContext.Provider
      value={{
        locale,
        setLocale,
        t: dictionaries[locale],
        theme,
        toggleTheme,
      }}
    >
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    throw new Error("useAppPreferences must be used within AppPreferencesProvider");
  }
  return ctx;
}

