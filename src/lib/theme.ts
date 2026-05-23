import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "peak-theme";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = theme;
}

/** Aplicar antes do React montar (evita flash do tema errado). Chamado em main.tsx. */
export function initThemeBeforeMount() {
  apply(getInitial());
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    apply(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* ignore */ }
  }, [theme]);

  const toggle = () => setTheme(t => (t === "light" ? "dark" : "light"));
  return { theme, setTheme, toggle };
}
