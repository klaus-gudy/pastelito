import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/** "+12%" against `previous`; null when there's nothing to compare with. */
function change(current: number, previous: number) {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * One headline number: a label, the value, and an optional note or change
 * against a comparison period.
 */
export function StatTile({
  label,
  icon: Icon,
  value,
  note,
  compare,
  href,
}: {
  label: string
  icon: LucideIcon
  value: string
  note?: string
  /** Shows the change from `previous` to `current`, e.g. vs last month. */
  compare?: { current: number; previous: number; period: string }
  /** Makes the tile a link to the page with the details. */
  href?: string
}) {
  const percent = compare ? change(compare.current, compare.previous) : null
  const Arrow = percent !== null && percent < 0 ? ArrowDownRight : ArrowUpRight

  const tile = (
    <Card
      className={href ? "h-full transition-colors hover:bg-muted/50" : "h-full"}
    >
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold">{value}</CardTitle>
        {note && (
          <CardDescription className="text-xs">{note}</CardDescription>
        )}
        {compare && (
          <CardDescription className="flex items-center gap-1 text-xs">
            {percent === null ? (
              `None in the ${compare.period} to compare`
            ) : (
              <>
                <Arrow className="size-3.5" aria-hidden />
                {percent > 0 ? "+" : ""}
                {percent}% vs {compare.period}
              </>
            )}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  )

  return href ? (
    <Link
      href={href}
      className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {tile}
    </Link>
  ) : (
    tile
  )
}
