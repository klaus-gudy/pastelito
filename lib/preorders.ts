import { prisma } from "@/lib/prisma"

// Stock is matched to preorders oldest first: whoever has waited longest gets
// the stock that is on hand.

export type PreorderNeed = {
  productId: string
  name: string
  sizeMl: number
  /** Units waiting on preorders. */
  ordered: number
  inStock: number
  /** Units to buy so every preorder can be delivered. */
  toBuy: number
}

/** Products that preorders need more of than is in stock. */
export async function preorderShortfall(userId: string) {
  const ordered = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: { sale: { userId, status: "PREORDER" } },
    _sum: { quantity: true },
  })
  if (ordered.length === 0) return []

  const products = await prisma.product.findMany({
    where: { userId, id: { in: ordered.map((row) => row.productId) } },
    orderBy: [{ name: "asc" }, { sizeMl: "asc" }],
    select: { id: true, name: true, sizeMl: true, quantityOnHand: true },
  })
  return products.flatMap((product): PreorderNeed[] => {
    const units =
      ordered.find((row) => row.productId === product.id)?._sum.quantity ?? 0
    const inStock = Math.max(product.quantityOnHand, 0)
    return units > inStock
      ? [
          {
            productId: product.id,
            name: product.name,
            sizeMl: product.sizeMl,
            ordered: units,
            inStock,
            toBuy: units - inStock,
          },
        ]
      : []
  })
}

/**
 * Ids of preorders that stock on hand can fill. Older preorders claim stock
 * first; one that can't be filled claims nothing, so a newer, smaller one can
 * still be ready.
 */
export async function readyPreorderIds(userId: string) {
  const preorders = await prisma.sale.findMany({
    where: { userId, status: "PREORDER" },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: {
      id: true,
      items: { select: { productId: true, quantity: true } },
    },
  })
  const productIds = [
    ...new Set(preorders.flatMap((p) => p.items.map((i) => i.productId))),
  ]
  const products = await prisma.product.findMany({
    where: { userId, id: { in: productIds } },
    select: { id: true, quantityOnHand: true },
  })
  const left = new Map(products.map((p) => [p.id, p.quantityOnHand]))

  const ready = new Set<string>()
  for (const preorder of preorders) {
    const needs = new Map<string, number>()
    for (const item of preorder.items) {
      needs.set(item.productId, (needs.get(item.productId) ?? 0) + item.quantity)
    }
    const fits = [...needs].every(
      ([productId, quantity]) => (left.get(productId) ?? 0) >= quantity
    )
    if (!fits) continue
    ready.add(preorder.id)
    for (const [productId, quantity] of needs) {
      left.set(productId, (left.get(productId) ?? 0) - quantity)
    }
  }
  return ready
}
