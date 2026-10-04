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
        <div className="rounded-lg border">
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
        {purchase.note && (
          <p className="text-sm text-muted-foreground">{purchase.note}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
