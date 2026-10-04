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

/** "0712345678" -> "0712 345 678", "+255712345678" -> "+255 712 345 678". */
export function formatPhone(phone: string) {
  const local = phone.match(/^(0\d{3})(\d{3})(\d{3})$/)
  if (local) return local.slice(1).join(" ")
  const intl = phone.match(/^(\+\d{3})(\d{3})(\d{3})(\d{3})$/)
  if (intl) return intl.slice(1).join(" ")
  return phone
}
