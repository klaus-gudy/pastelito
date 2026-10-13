"use client"

import { Link2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** Copies the shop's public order page link, for sharing with customers. */
export function OrderLinkButton({ shopId }: { shopId: string }) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const url = `${window.location.origin}/order/${shopId}`
        try {
          await navigator.clipboard.writeText(url)
          toast.success("Order link copied. Share it with your customers.")
        } catch {
          toast.message(url, { description: "Copy this link to share it." })
        }
      }}
    >
      <Link2 data-icon="inline-start" />
      Copy order link
    </Button>
  )
}
