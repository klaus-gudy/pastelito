import type { Metadata } from "next"
import { Sparkles } from "lucide-react"

import { NotFoundState } from "@/components/not-found-state"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = { title: "Page not found · Pastelito" }

// Addresses that match no page. Rendered in the root layout, so it carries
// the app's own logo and theme toggle, like the sign-in pages.
export default function NotFound() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <span className="flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        Pastelito
      </span>
      <NotFoundState className="w-full max-w-md flex-none border border-dashed" />
    </main>
  )
}
