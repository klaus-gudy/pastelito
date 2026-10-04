import type {
  CapitalEntryType,
  CapitalSourceType,
  PaymentMethod,
} from "@/lib/generated/prisma/enums"

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  MOBILE_MONEY: "Mobile money",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  OTHER: "Other",
}

export const capitalSourceTypes: Record<
  CapitalSourceType,
  { label: string; description: string }
> = {
  OWNER: { label: "Owner", description: "Your own money put into the business." },
  INVESTOR: { label: "Investor", description: "Someone who invested in the business." },
  LOAN: { label: "Loan", description: "Borrowed money that must be paid back." },
}

export const capitalEntryLabels: Record<CapitalEntryType, string> = {
  RECEIVED: "Received",
  REPAID: "Repaid",
}
