import type { Prisma } from "@/lib/generated/prisma/client"

type Amount = Prisma.Decimal | number | string

// Prices are whole Tanzanian shillings, e.g. "TZS 45,000".
const money = new Intl.NumberFormat("en-TZ", {
  style: "currency",
  currency: "TZS",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
})

export function formatMoney(amount: Amount) {
  return money.format(Number(amount.toString()))
}

const count = new Intl.NumberFormat("en-TZ")

export function formatCount(value: number) {
  return count.format(value)
}
