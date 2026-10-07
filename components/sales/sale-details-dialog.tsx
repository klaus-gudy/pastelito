"use client"

import { useState, type ReactNode } from "react"
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
  actions,
}: {
  sale: SaleDetails
  verified: boolean
  today: string
  preorder?: boolean
  /** More buttons beside Pay; `close` shuts this dialog first. */
  actions?: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [recording, setRecording] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setRecording(false)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye data-icon="inline-start" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl lg:max-w-2xl">
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
        <>
          <div className="hidden rounded-lg border sm:block">
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
                    {/* max-w-0 lets a long name cut off instead of
                        widening the table past the dialog. */}
                    <TableCell className="w-full max-w-0 pl-4 font-medium">
                      <span className="block truncate" title={item.label}>
                        {item.label}
                      </span>
                      {item.brand && (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
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
          <ul className="divide-y rounded-lg border text-sm sm:hidden">
            {sale.items.map((item) => (
              <li key={item.key} className="flex justify-between gap-4 p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium" title={item.label}>
                    {item.label}
                  </div>
                  {item.brand && (
                    <div className="truncate text-xs text-muted-foreground">
                      {item.brand}
                    </div>
                  )}
                  <div className="text-muted-foreground tabular-nums">
                    {item.quantity} × {item.unitPrice}
                  </div>
                </div>
                <span className="shrink-0 tabular-nums">{item.lineTotal}</span>
              </li>
            ))}
            {sale.discount && (
              <>
                <li className="flex justify-between gap-4 bg-muted/50 p-3">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{sale.subtotal}</span>
                </li>
                <li className="flex justify-between gap-4 bg-muted/50 p-3">
                  <span>Discount</span>
                  <span className="tabular-nums">−{sale.discount}</span>
                </li>
              </>
            )}
            <li className="flex justify-between gap-4 bg-muted/50 p-3 font-medium">
              <span>Total</span>
              <span className="tabular-nums">{sale.total}</span>
            </li>
          </ul>
        </>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Payments</h3>
          {sale.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing paid yet.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Paid by</TableHead>
                    <TableHead className="pr-4 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.payments.map((payment) => (
                    <TableRow key={payment.key}>
                      <TableCell className="pl-4">{payment.date}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">
                        {payment.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <dl className="grid gap-2 rounded-lg border bg-muted/50 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="tabular-nums">{sale.total}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Already paid</dt>
            <dd className="tabular-nums">{sale.paid}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t pt-2 font-medium">
            <dt>Still owed</dt>
            <dd className="tabular-nums">{sale.balance ?? "Paid in full"}</dd>
          </div>
        </dl>

        {recording ? (
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
          (sale.balance || actions) && (
            <div className="flex flex-wrap gap-2">
              {sale.balance && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRecording(true)}
                >
                  <HandCoins data-icon="inline-start" />
                  Pay
                </Button>
              )}
              {actions?.(() => setOpen(false))}
            </div>
          )
        )}

        {sale.note && (
          <p className="text-sm text-muted-foreground">{sale.note}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
