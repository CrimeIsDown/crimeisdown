"use client";

import * as React from "react";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { themeStorageKey, type ThemePreference } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themeOptions: { label: string; value: ThemePreference }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveStoredTheme(): ThemePreference {
  const datasetTheme = document.documentElement.dataset.theme;

  if (
    datasetTheme === "light" ||
    datasetTheme === "dark" ||
    datasetTheme === "system"
  ) {
    return datasetTheme;
  }

  const storedTheme = window.localStorage.getItem(themeStorageKey);

  if (
    storedTheme === "light" ||
    storedTheme === "dark" ||
    storedTheme === "system"
  ) {
    return storedTheme;
  }

  return "system";
}

function applyTheme(theme: ThemePreference) {
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  window.localStorage.setItem(themeStorageKey, theme);
}

export default function ModeToggle() {
  const [theme, setTheme] = React.useState<ThemePreference>("system");

  React.useEffect(() => {
    const syncTheme = () => {
      setTheme(resolveStoredTheme());
    };

    syncTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (resolveStoredTheme() === "system") {
        applyTheme("system");
        syncTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative rounded-full"
            aria-label="Toggle theme"
          />
        }
      >
        <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => {
              applyTheme(option.value);
              setTheme(option.value);
            }}
            className="justify-between"
          >
            <span className="inline-flex items-center gap-2">
              {option.value === "light" ? (
                <SunIcon className="size-4" />
              ) : option.value === "dark" ? (
                <MoonIcon className="size-4" />
              ) : (
                <MonitorIcon className="size-4" />
              )}
              {option.label}
            </span>
            {theme === option.value && <CheckIcon className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
