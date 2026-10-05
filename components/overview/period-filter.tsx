"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Period } from "@/lib/dates"

const options: { value: Period; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "6months", label: "Past 6 months" },
  { value: "all", label: "All time" },
]

/** Picks the period the figures cover; kept in the URL (?period=). */
export function PeriodFilter({ value }: { value: Period }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={value}
      aria-label="Period"
      data-pending={pending || undefined}
      className="data-pending:opacity-60"
      onValueChange={(next) => {
        // Clicking the selected option would clear it; keep one selected.
        if (!next) return
        // This month is the default and needs no param.
        const query = next === "month" ? "" : `?period=${next}`
        startTransition(() =>
          router.replace(`${pathname}${query}`, { scroll: false })
        )
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
