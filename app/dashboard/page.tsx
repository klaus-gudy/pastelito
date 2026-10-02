import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Sparkles } from "lucide-react"

import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { signOutUser } from "@/lib/actions/auth"

export const metadata: Metadata = { title: "Dashboard · Pastelito" }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/sign-in?callbackUrl=/dashboard")

  const firstName = session.user.name?.split(" ")[0]

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          Pastelito
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {session.user.email}
          </span>
          <form action={signOutUser}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {firstName ? `Hi, ${firstName}` : "Welcome"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          You&apos;re signed in. Your sales tracking will live here.
        </p>
      </main>
    </div>
  )
}
