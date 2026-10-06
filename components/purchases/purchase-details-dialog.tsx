"use client"

import { Eye } from "lucide-react"

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

export type PurchaseDetails = {
  date: string
  supplier: string | null
  method: string
  note: string | null
  total: string
  items: { label: string; quantity: number; unitCost: string; lineTotal: string }[]
}

export function PurchaseDetailsDialog({
  purchase,
}: {
  purchase: PurchaseDetails
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye data-icon="inline-start" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Purchase{purchase.supplier ? ` from ${purchase.supplier}` : ""}
          </DialogTitle>
          <DialogDescription>
            {purchase.date} · Paid by {purchase.method}
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
                    <TableCell className="pl-4 font-medium">{item.label}</TableCell>
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
                  <div className="font-medium">{item.label}</div>
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
        {purchase.note && (
          <p className="text-sm text-muted-foreground">{purchase.note}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
