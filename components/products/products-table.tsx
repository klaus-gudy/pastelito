import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Product } from "@/lib/generated/prisma/client"
import { formatCount, formatMoney } from "@/lib/format"

export function ProductsTable({ products }: { products: Product[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Product</TableHead>
            <TableHead>Size</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="pr-4 text-right">In stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="pl-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{product.name}</span>
                  {!product.active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatCount(product.sizeMl)} ml</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(product.sellingPrice)}
              </TableCell>
              <TableCell className="pr-4 text-right tabular-nums">
                {product.quantityOnHand > 0 ? (
                  formatCount(product.quantityOnHand)
                ) : (
                  <Badge variant="outline">Out of stock</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
