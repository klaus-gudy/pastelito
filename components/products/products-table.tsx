import {
  MobileCard,
  MobileCardActions,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
import { ProductRowActions } from "@/components/products/product-row-actions"
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

export function ProductsTable({
  products,
  verified,
}: {
  products: Product[]
  verified: boolean
}) {
  const actions = (product: Product) => (
    <ProductRowActions
      verified={verified}
      quantityOnHand={product.quantityOnHand}
      product={{
        id: product.id,
        name: product.name,
        sizeMl: product.sizeMl,
        // Prices are whole shillings; the form wants plain digits.
        buyingPrice: product.buyingPrice?.toFixed(0) ?? "",
        sellingPrice: product.sellingPrice.toFixed(0),
      }}
    />
  )

  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Product</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Selling price</TableHead>
              <TableHead>In stock</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
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
                <TableCell className="tabular-nums">
                  {formatMoney(product.sellingPrice)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {product.quantityOnHand > 0 ? (
                    formatCount(product.quantityOnHand)
                  ) : (
                    <Badge variant="outline">Out of stock</Badge>
                  )}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">{actions(product)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {products.map((product) => (
          <MobileCard key={product.id}>
            <MobileCardHeader
              title={product.name}
              badge={!product.active && <Badge variant="secondary">Inactive</Badge>}
              description={`${formatCount(product.sizeMl)} ml`}
              aside={
                <span className="font-medium tabular-nums">
                  {formatMoney(product.sellingPrice)}
                </span>
              }
            />
            <MobileCardFields>
              <MobileCardField label="In stock">
                {product.quantityOnHand > 0 ? (
                  <span className="tabular-nums">
                    {formatCount(product.quantityOnHand)}
                  </span>
                ) : (
                  <Badge variant="outline">Out of stock</Badge>
                )}
              </MobileCardField>
            </MobileCardFields>
            <MobileCardActions>{actions(product)}</MobileCardActions>
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
