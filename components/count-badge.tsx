import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Round count bubble; fits two digits, shows "99+" beyond that. */
export function CountBadge({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  const label = count > 99 ? "99+" : String(count)
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-6 min-w-6 justify-center rounded-full px-1 text-xs tabular-nums",
        className
      )}
    >
      {label}
    </Badge>
  )
}
