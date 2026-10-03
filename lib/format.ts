import type { Prisma } from "@/lib/generated/prisma/client"

type Amount = Prisma.Decimal | number | string

const whole = new Intl.NumberFormat("en-TZ", {
  style: "currency",
  currency: "TZS",
  maximumFractionDigits: 0,
})
const withCents = new Intl.NumberFormat("en-TZ", {
  style: "currency",
  currency: "TZS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "TSh 45,000", or "TSh 1,250.50" when there are cents. */
export function formatMoney(amount: Amount) {
  const value = Number(amount.toString())
  return Number.isInteger(value) ? whole.format(value) : withCents.format(value)
}

const count = new Intl.NumberFormat("en-TZ")

export function formatCount(value: number) {
  return count.format(value)
}
