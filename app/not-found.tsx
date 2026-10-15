import type { Metadata } from "next"

import { BrandMark } from "@/components/brand-mark"
import { NotFoundState } from "@/components/not-found-state"
import { ThemeToggle } from "@/components/theme-toggle"
import { Wordmark } from "@/components/wordmark"

export const metadata: Metadata = { title: "Page not found · Pastelito" }

// Addresses that match no page. Rendered in the root layout, so it carries
// the app's own logo and theme toggle, like the sign-in pages.
export default function NotFound() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <span className="flex items-center gap-2">
        <BrandMark className="size-10" />
        <Wordmark className="h-9" />
      </span>
      <NotFoundState className="w-full max-w-md flex-none border border-dashed" />
    </main>
  )
}
