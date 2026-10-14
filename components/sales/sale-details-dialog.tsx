"use client"

import { useState, type ReactNode } from "react"
import { Eye, HandCoins, Trash2, Undo2 } from "lucide-react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { PaymentsSummary } from "@/components/payments-summary"
import { PaymentRowActions } from "@/components/sales/payment-row-actions"
import {
  PaymentForm,
  type EditablePayment,
} from "@/components/sales/record-payment-dialog"
import {
  ReturnSaleDialog,
  type ReturnableSale,
} from "@/components/sales/return-sale-dialog"
import { VerifyFirst } from "@/components/verify-first"
import { removeSale } from "@/lib/actions/sales"
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
  /** Paid so far in whole shillings, net of refunds. */
  paidAmount: number
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
  payments: {
    key: string
    date: string
    method: string
    amount: string
    /** Set when the payment can be corrected; refunds can't. */
    edit: EditablePayment | null
  }[]
  /** Items brought back, oldest first. */
  returns: {
    key: string
    date: string
    items: string
    credit: string
    refund: string | null
    note: string | null
  }[]
  /** A completed sale with items left that could come back. */
  returnable: ReturnableSale | null
  /** A completed sale, which can be deleted if it was a mistake. */
  deletable: boolean
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
  const [returning, setReturning] = useState(false)
  const [editing, setEditing] = useState<EditablePayment | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Only one inline form at a time.
  const busy = recording || editing !== null

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setRecording(false)
            setEditing(null)
          }
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

          {sale.returns.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Returns</h3>
              <ul className="divide-y rounded-lg border text-sm">
                {sale.returns.map((item) => (
                  <li key={item.key} className="grid gap-1 p-3">
                    <div className="flex justify-between gap-4">
                      <span className="min-w-0 truncate font-medium">
                        {item.items}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        −{item.credit}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {item.date}
                      {item.refund
                        ? ` · ${item.refund} refunded`
                        : " · taken off the balance"}
                      {item.note && ` · ${item.note}`}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PaymentsSummary
            payments={sale.payments.map((payment) => ({
              ...payment,
              actions: payment.edit && !busy && (
                <PaymentRowActions
                  paymentId={payment.key}
                  what={`${payment.amount} paid on ${payment.date}`}
                  onEdit={() => setEditing(payment.edit)}
                />
              ),
            }))}
            total={sale.total}
            paid={sale.paid}
            owed={sale.balance ?? "Paid in full"}
          />

          {busy ? (
            verified ? (
              <PaymentForm
                key={editing?.id ?? "new"}
                className="rounded-lg border p-4"
                sale={sale}
                payment={editing ?? undefined}
                today={today}
                onDone={() => {
                  setRecording(false)
                  setEditing(null)
                }}
              />
            ) : (
              <VerifyFirst action="record payments" />
            )
          ) : (
            (sale.balance || sale.returnable || sale.deletable || actions) && (
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
                {sale.returnable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(false)
                      setReturning(true)
                    }}
                  >
                    <Undo2 data-icon="inline-start" />
                    Return items
                  </Button>
                )}
                {actions?.(() => setOpen(false))}
                {sale.deletable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive sm:ml-auto"
                    onClick={() => {
                      setOpen(false)
                      setDeleting(true)
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete sale
                  </Button>
                )}
              </div>
            )
          )}

          {sale.note && (
            <p className="text-sm text-muted-foreground">{sale.note}</p>
          )}
        </DialogContent>
      </Dialog>
      {sale.deletable && (
        <ConfirmDeleteDialog
          open={deleting}
          onOpenChange={setDeleting}
          title="Delete this sale?"
          description={`For a sale recorded by mistake. Its items go back into stock${sale.paidAmount > 0 ? `, the ${sale.paid} paid comes back out of your cash,` : ""} and its payments and returns are removed. This can't be undone.`}
          action={() => removeSale(sale.id)}
        />
      )}
      {sale.returnable && (
        <ReturnSaleDialog
          sale={sale.returnable}
          verified={verified}
          today={today}
          open={returning}
          onOpenChange={setReturning}
        />
      )}
    </>
  )
}
