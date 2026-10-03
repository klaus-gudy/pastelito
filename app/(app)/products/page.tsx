import type { Metadata } from "next"

import { findNavItem } from "@/components/dashboard/navigation"
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder"

export const metadata: Metadata = { title: "Products · Pastelito" }

export default function ProductsPage() {
  return <SectionPlaceholder item={findNavItem("/products")!} />
}
