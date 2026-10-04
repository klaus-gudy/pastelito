"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { Tabs } from "@/components/ui/tabs"

/**
 * Tabs whose selection lives in the URL (?tab=), so reloads, pagination and
 * shared links open on the same tab. The first tab is the default and has no
 * param.
 */
export function UrlTabs({
  defaultValue,
  firstTab,
  className,
  children,
}: {
  defaultValue: string
  firstTab: string
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(defaultValue)

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        setValue(next)
        // Switching tabs starts that tab from page 1.
        const query = next === firstTab ? "" : `?tab=${next}`
        router.replace(`${pathname}${query}`, { scroll: false })
      }}
      className={className}
    >
      {children}
    </Tabs>
  )
}
