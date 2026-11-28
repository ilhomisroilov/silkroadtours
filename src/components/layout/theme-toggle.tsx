"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type Theme = "dark" | "light";
const KEY = "nt-theme";

/** Runs in <head> before the first paint, so a visitor who chose Day never sees a flash of Night. */
export const THEME_SCRIPT = `try{if(localStorage.getItem("${KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#eaf1f8" : "#0e1830");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}

/** Night / Day switch. Same glass design in both; only the colours change. */
export function ThemeToggle({ toLight, toDark, className }: { toLight: string; toDark: string; className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    // Re-apply the stored choice: some pages (the 404) re-render <html> after the head script ran.
    let stored: Theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    try {
      if (localStorage.getItem(KEY) === "light") stored = "light";
    } catch {
      /* storage blocked */
    }
    if (stored === "light") document.documentElement.dataset.theme = "light";
    setTheme(stored);
  }, []);
  const next: Theme = theme === "light" ? "dark" : "light";
  const label = next === "light" ? toLight : toDark;
  return (
    <button
      type="button"
      onClick={() => {
        apply(next);
        setTheme(next);
      }}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand",
        className,
      )}
    >
      {theme === "light" ? <Moon aria-hidden="true" className="size-5" /> : <Sun aria-hidden="true" className="size-5" />}
    </button>
  );
}
