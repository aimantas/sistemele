import { useState } from "react";

/**
 * Light is the default. Each person can switch the admin panel to dark; the
 * choice stays in this browser (localStorage) and sets `.dark` on <html>,
 * which switches the tokens in styles.css. The public site is always light.
 */
export type Theme = "light" | "dark";

const KEY = "sistemele.theme";

export function storedTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0f1013" : "#f8f9fb");
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  return [
    theme,
    (next) => {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Private mode: the switch still applies for this visit.
      }
      applyTheme(next);
      setTheme(next);
    },
  ];
}
