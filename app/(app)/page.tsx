import type { Metadata } from "next"
import { Banknote, Boxes, ReceiptText } from "lucide-react"

import { VerifyEmailBanner } from "@/components/auth/verify-email-banner"
import { overviewItem } from "@/components/dashboard/navigation"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/current-user"

export const metadata: Metadata = { title: "Overview · Pastelito" }

const position = [
  { label: "Cash", icon: Banknote },
  { label: "Unsold stock", icon: Boxes },
  { label: "Customer debts", icon: ReceiptText },
]

export default async function OverviewPage() {
  const user = await requireUser()
  const firstName = user.name?.split(" ")[0]

  return (
    <div className="flex flex-col gap-6">
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Hi, ${firstName}` : "Welcome"}
        </h2>
        <p className="mt-1 text-muted-foreground">{overviewItem.question}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {position.map(({ label, icon: Icon }) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Icon className="size-4" />
                {label}
              </CardDescription>
              <CardTitle className="font-mono text-2xl">—</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        These fill in as you record purchases and sales.
      </p>
    </div>
  )
}
