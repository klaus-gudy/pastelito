"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { flushSync } from "react-dom"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark"
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    // Cross-fade a snapshot of the page instead of animating every element's
    // colours. Browsers without the API (or users who prefer reduced motion)
    // just get the instant swap.
    if (reduceMotion || !document.startViewTransition) {
      setTheme(next)
      return
    }

    document.startViewTransition(() => {
      // The new theme must be on <html> before the callback returns so the
      // "new" snapshot is taken with it applied.
      flushSync(() => setTheme(next))
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={toggle}
    >
      {/* Icons swap with CSS so the server render never mismatches. */}
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
