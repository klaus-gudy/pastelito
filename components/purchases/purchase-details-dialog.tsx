"use client"

import { useState } from "react"
import { Eye, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import {
  PaymentsSummary,
  type PaymentLine,
} from "@/components/payments-summary"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { removePurchase } from "@/lib/actions/purchases"

export type PurchaseDetails = {
  id: string
  date: string
  supplier: string | null
  note: string | null
  total: string
  payments: PaymentLine[]
  paid: string
  /** The amount still owed, or a word such as "Paid in full". */
  owed: string
  items: { label: string; quantity: number; unitCost: string; lineTotal: string }[]
}

export function PurchaseDetailsDialog({
  purchase,
}: {
  purchase: PurchaseDetails
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye data-icon="inline-start" />
            View
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Purchase{purchase.supplier ? ` from ${purchase.supplier}` : ""}
            </DialogTitle>
            <DialogDescription>
              {purchase.date} · Paid in full
            </DialogDescription>
          </DialogHeader>
          <>
            <div className="hidden rounded-lg border sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit cost</TableHead>
                    <TableHead className="pr-4">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.items.map((item) => (
                    <TableRow key={item.label}>
                      {/* max-w-0 lets a long name cut off instead of
                          widening the table past the dialog. */}
                      <TableCell className="w-full max-w-0 pl-4 font-medium">
                        <span className="block truncate" title={item.label}>
                          {item.label}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="tabular-nums">{item.unitCost}</TableCell>
                      <TableCell className="pr-4 tabular-nums">
                        {item.lineTotal}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-4" colSpan={3}>
                      Total
                    </TableCell>
                    <TableCell className="pr-4 tabular-nums">
                      {purchase.total}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <ul className="divide-y rounded-lg border text-sm sm:hidden">
              {purchase.items.map((item) => (
                <li key={item.label} className="flex justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium" title={item.label}>
                      {item.label}
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      {item.quantity} × {item.unitCost}
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums">{item.lineTotal}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4 bg-muted/50 p-3 font-medium">
                <span>Total</span>
                <span className="tabular-nums">{purchase.total}</span>
              </li>
            </ul>
          </>
          <PaymentsSummary
            payments={purchase.payments}
            total={purchase.total}
            paid={purchase.paid}
            owed={purchase.owed}
          />
          {purchase.note && (
            <p className="text-sm text-muted-foreground">{purchase.note}</p>
          )}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setOpen(false)
                setDeleting(true)
              }}
            >
              <Trash2 data-icon="inline-start" />
              Delete purchase
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this purchase?"
        description={`For a purchase recorded by mistake. Its stock comes off your products and the ${purchase.total} goes back into your cash. Only possible while all of that stock is still on hand. To fix a mistake, delete it and record it again.`}
        action={() => removePurchase(purchase.id)}
      />
    </>
  )
}
