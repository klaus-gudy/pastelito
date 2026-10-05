"use client"

import { useState } from "react"
import { Eye, HandCoins } from "lucide-react"
import { PaymentForm } from "@/components/sales/record-payment-dialog"
import { VerifyFirst } from "@/components/verify-first"
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

export type SaleDetails = {
  id: string
  date: string
  /** For a delivered preorder, the day it was ordered. */
  orderedOn: string | null
  customer: string | null
  note: string | null
  subtotal: string
  discount: string | null
  total: string
  paid: string
  balance: string | null
  /** Unpaid amount in whole shillings; shown as the amount placeholder. */
  balanceAmount: number
  items: {
    key: string
    label: string
    brand: string | null
    quantity: number
    unitPrice: string
    lineTotal: string
  }[]
  payments: { key: string; date: string; method: string; amount: string }[]
}

export function SaleDetailsDialog({
  sale,
  verified,
  today,
  preorder = false,
}: {
  sale: SaleDetails
  verified: boolean
  today: string
  preorder?: boolean
}) {
  const [recording, setRecording] = useState(false)

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setRecording(false)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye data-icon="inline-start" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {preorder
              ? `Preorder for ${sale.customer}`
              : `Sale to ${sale.customer ?? "walk-in customer"}`}
          </DialogTitle>
          <DialogDescription>
            {sale.orderedOn
              ? `Delivered ${sale.date} · ordered ${sale.orderedOn}`
              : sale.date}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead className="pr-4">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item.key}>
                  <TableCell className="pl-4 font-medium">
                    {item.label}
                    {item.brand && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {item.brand}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="tabular-nums">{item.unitPrice}</TableCell>
                  <TableCell className="pr-4 tabular-nums">
                    {item.lineTotal}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              {sale.discount && (
                <>
                  <TableRow>
                    <TableCell className="pl-4" colSpan={3}>
                      Subtotal
                    </TableCell>
                    <TableCell className="pr-4 tabular-nums">
                      {sale.subtotal}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-4" colSpan={3}>
                      Discount
                    </TableCell>
                    <TableCell className="pr-4 tabular-nums">
                      −{sale.discount}
                    </TableCell>
                  </TableRow>
                </>
              )}
              <TableRow>
                <TableCell className="pl-4" colSpan={3}>
                  Total
                </TableCell>
                <TableCell className="pr-4 tabular-nums">{sale.total}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Payments</h3>
          {sale.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing paid yet.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {sale.payments.map((payment) => (
                <li key={payment.key} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {payment.date} · {payment.method}
                  </span>
                  <span className="tabular-nums">{payment.amount}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="flex justify-between gap-4 border-t pt-2 text-sm font-medium">
            <span>{sale.balance ? "Still owed" : "Paid in full"}</span>
            <span className="tabular-nums">{sale.balance ?? sale.paid}</span>
          </p>
          {sale.balance &&
            (recording ? (
              verified ? (
                <PaymentForm
                  className="rounded-lg border p-4"
                  sale={sale}
                  today={today}
                  onDone={() => setRecording(false)}
                />
              ) : (
                <VerifyFirst action="record payments" />
              )
            ) : (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRecording(true)}
                >
                  <HandCoins data-icon="inline-start" />
                  Pay
                </Button>
              </div>
            ))}
        </div>

        {sale.note && (
          <p className="text-sm text-muted-foreground">{sale.note}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
