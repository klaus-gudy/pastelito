"use client"

import { usePathname } from "next/navigation"

import { activeNavItem } from "@/components/dashboard/navigation"
import { Wordmark } from "@/components/wordmark"

export function PageTitle() {
  const item = activeNavItem(usePathname())
  return <h1 className="text-sm font-medium">{item?.title ?? <Wordmark />}</h1>
}
