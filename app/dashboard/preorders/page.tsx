import type { Metadata } from "next"

import { findNavItem } from "@/components/dashboard/navigation"
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder"

export const metadata: Metadata = { title: "Preorders · Pastelito" }

export default function PreordersPage() {
  return <SectionPlaceholder item={findNavItem("/dashboard/preorders")!} />
}
