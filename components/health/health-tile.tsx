import { statusStyles } from "@/components/health/status"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Indicator } from "@/lib/health"

/** One health indicator: its value, target, status and why. */
export function HealthTile({ indicator }: { indicator: Indicator }) {
  const { label, color, icon: Icon } = statusStyles[indicator.status]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted underline-offset-4">
                {indicator.label}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
              {indicator.explain}
            </TooltipContent>
          </Tooltip>
        </CardDescription>
        <CardTitle className="text-2xl font-semibold">{indicator.value}</CardTitle>
        <CardDescription className="text-xs">{indicator.target}</CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto flex-col items-start gap-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="size-4" style={{ color }} aria-hidden />
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{indicator.reason}</span>
      </CardFooter>
    </Card>
  )
}
