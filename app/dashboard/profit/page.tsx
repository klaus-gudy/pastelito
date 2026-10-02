import type { Metadata } from "next"

import { findNavItem } from "@/components/dashboard/navigation"
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder"

export const metadata: Metadata = { title: "Profit · Pastelito" }

export default function ProfitPage() {
  return <SectionPlaceholder item={findNavItem("/dashboard/profit")!} />
}
