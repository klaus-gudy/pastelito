import type { Metadata } from "next"

import { findNavItem } from "@/components/dashboard/navigation"
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder"

export const metadata: Metadata = { title: "Expenses · Pastelito" }

export default function ExpensesPage() {
  return <SectionPlaceholder item={findNavItem("/dashboard/expenses")!} />
}
