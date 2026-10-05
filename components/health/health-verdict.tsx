import { statusStyles } from "@/components/health/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Verdict } from "@/lib/health"

/** The overall verdict: doing well, needs attention, or at risk. */
export function HealthVerdict({ verdict }: { verdict: Verdict }) {
  const { color, icon: Icon } = statusStyles[verdict.status]

  return (
    <Alert>
      <Icon style={{ color }} aria-hidden />
      <AlertTitle className="text-base">{verdict.title}</AlertTitle>
      <AlertDescription>{verdict.detail}</AlertDescription>
    </Alert>
  )
}
