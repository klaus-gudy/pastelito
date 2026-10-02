import type { Metadata } from "next"

import { findNavItem } from "@/components/dashboard/navigation"
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder"

export const metadata: Metadata = { title: "Customers · Pastelito" }

export default function CustomersPage() {
  return <SectionPlaceholder item={findNavItem("/dashboard/customers")!} />
}
