import type { Metadata } from "next"

import { findNavItem } from "@/components/dashboard/navigation"
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder"

export const metadata: Metadata = { title: "Purchases · Pastelito" }

export default function PurchasesPage() {
  return <SectionPlaceholder item={findNavItem("/dashboard/purchases")!} />
}
