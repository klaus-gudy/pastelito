import {
  CircleCheck,
  CircleDashed,
  CircleX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"

import type { Status } from "@/lib/health"

// Status colours are fixed (not themed) and always shown with an icon and a
// label, so a state never rests on colour alone.
export const statusStyles: Record<
  Status,
  { label: string; color: string; icon: LucideIcon }
> = {
  good: { label: "On track", color: "#0ca30c", icon: CircleCheck },
  watch: { label: "Watch", color: "#fab219", icon: TriangleAlert },
  action: { label: "Needs action", color: "#d03b3b", icon: CircleX },
  none: {
    label: "Not enough data",
    color: "var(--muted-foreground)",
    icon: CircleDashed,
  },
}
