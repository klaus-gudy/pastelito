"use client"

import { ErrorState } from "@/components/error-state"

// Errors in a dashboard page; the sidebar and header stay usable.
export default function DashboardError(props: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorState {...props} className="flex-1 border border-dashed" />
}
