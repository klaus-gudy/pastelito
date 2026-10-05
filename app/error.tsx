"use client"

import { ErrorState } from "@/components/error-state"

// Errors in a section layout (e.g. the dashboard layout loading the user) or
// in pages without their own boundary, such as sign-in.
export default function RootError(props: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <main className="flex flex-1 flex-col p-4">
      <ErrorState {...props} className="flex-1" />
    </main>
  )
}
