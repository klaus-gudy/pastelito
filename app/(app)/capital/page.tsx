import type { Metadata } from "next"

import { findNavItem } from "@/components/dashboard/navigation"
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder"

export const metadata: Metadata = { title: "Capital · Pastelito" }

export default function CapitalPage() {
  return <SectionPlaceholder item={findNavItem("/capital")!} />
}
