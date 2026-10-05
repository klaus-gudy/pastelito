import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** "+12%" against `previous`; null when there's nothing to compare with. */
function change(current: number, previous: number) {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * One headline number: a label, the value, and an optional change against a
 * comparison period. The note explaining the number shows when the label is
 * hovered.
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
  /** Explains the number; shown in a tooltip on the label. */
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
          {note ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-4">
                  {label}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-56">{note}</TooltipContent>
            </Tooltip>
          ) : (
            label
          )}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold">{value}</CardTitle>
        {percent !== null && (
          <CardDescription className="flex items-center gap-1 text-xs">
            <Arrow className="size-3.5" aria-hidden />
            {percent > 0 ? "+" : ""}
            {percent}% vs {compare?.period}
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
