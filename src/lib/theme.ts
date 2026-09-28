import type { ThemeMode } from "./settings";

const KEY = "themeMode";

function isMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function applyTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  syncThemeClass(mode);
}

export function syncThemeClass(mode: ThemeMode): void {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function readCachedTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (isMode(raw)) return raw;
  } catch {}
  return "system";
}
