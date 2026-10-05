import Link from "next/link"
import { ShoppingBag } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCount } from "@/lib/format"
import type { PreorderNeed } from "@/lib/preorders"

/** What to buy so every waiting preorder can be delivered. */
export function ToBuyList({ needs }: { needs: PreorderNeed[] }) {
  const units = needs.reduce((sum, need) => sum + need.toBuy, 0)

  return (
    <section className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">To buy for preorders</h2>
          <p className="text-sm text-muted-foreground">
            {formatCount(units)} {units === 1 ? "unit" : "units"} short across{" "}
            {needs.length} {needs.length === 1 ? "product" : "products"}.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/purchases?buy=preorders">
            <ShoppingBag data-icon="inline-start" />
            Buy these
          </Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-0">Product</TableHead>
            <TableHead>Ordered</TableHead>
            <TableHead>In stock</TableHead>
            <TableHead className="pr-0">To buy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {needs.map((need) => (
            <TableRow key={need.productId}>
              <TableCell className="pl-0 font-medium">
                {need.name} {formatCount(need.sizeMl)} ml
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCount(need.ordered)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCount(need.inStock)}
              </TableCell>
              <TableCell className="pr-0 font-medium tabular-nums">
                {formatCount(need.toBuy)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
