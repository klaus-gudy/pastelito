import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"

import { BrandMark } from "@/components/brand-mark"
import { PublicOrderForm } from "@/components/order/public-order-form"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Wordmark } from "@/components/wordmark"
import { isVerified } from "@/lib/email-verification"
import { formatCount } from "@/lib/format"
import { normalizeOrderCode, orderSlugFor } from "@/lib/order-slug"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Place an order · Pastelito" }

// Anyone with the link can order from this shop; no account needed.
export default async function PublicOrderPage({
  params,
}: PageProps<"/order/[slug]">) {
  const { slug } = await params
  const code = normalizeOrderCode(slug)
  const shop = await prisma.user.findUnique({
    where: { orderSlug: code },
    select: { id: true, emailVerified: true },
  })
  if (!shop) {
    // The first links used the account id; send those to the short link.
    const byId = await prisma.user.findUnique({
      where: { id: slug },
      select: { id: true },
    })
    if (byId) permanentRedirect(`/order/${await orderSlugFor(byId.id)}`)
    notFound()
  }
  // Send a lowercase link to the uppercase one, so only one form is shared.
  if (code !== slug) permanentRedirect(`/order/${code}`)
  if (!isVerified(shop)) notFound()

  const products = await prisma.product.findMany({
    where: { userId: shop.id, active: true },
    orderBy: [{ name: "asc" }, { sizeMl: "asc" }],
    select: { id: true, name: true, sizeMl: true, sellingPrice: true },
  })

  return (
    <main className="relative flex flex-1 flex-col items-center gap-8 px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <span className="flex items-center gap-2">
        <BrandMark className="size-10" />
        <Wordmark className="text-4xl" />
      </span>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Place a preorder</CardTitle>
          <CardDescription>
            Tell us what you&apos;d like. We&apos;ll notify you to confirm and
            arrange payment and delivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing is available to order yet. Check back soon.
            </p>
          ) : (
            <PublicOrderForm
              shopSlug={code}
              products={products.map((product) => ({
                id: product.id,
                label: `${product.name} ${formatCount(product.sizeMl)} ml`,
                price: product.sellingPrice.toNumber(),
              }))}
            />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
