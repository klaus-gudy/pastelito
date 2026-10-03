import type { Metadata } from "next"

import { findNavItem } from "@/components/dashboard/navigation"
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder"

export const metadata: Metadata = { title: "Sales · Pastelito" }

export default function SalesPage() {
  return <SectionPlaceholder item={findNavItem("/sales")!} />
}
