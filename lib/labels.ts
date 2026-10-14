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

/** Kinds of business expense, stored by key. */
export const expenseCategories = {
  RENT: "Rent",
  TRANSPORT: "Transport",
  PACKAGING: "Packaging",
  MARKETING: "Marketing",
  UTILITIES: "Utilities",
  SALARIES: "Salaries",
  FEES: "Fees and taxes",
  OTHER: "Other",
} as const

export type ExpenseCategory = keyof typeof expenseCategories

/** The label for a stored category; unknown keys show as they are. */
export function expenseCategoryLabel(category: string) {
  return category in expenseCategories
    ? expenseCategories[category as ExpenseCategory]
    : category
}
