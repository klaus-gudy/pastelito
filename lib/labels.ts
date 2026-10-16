import type {
  CapitalEntryType,
  CapitalSourceType,
  CashJournalKind,
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

export const cashJournalKindLabels: Record<CashJournalKind, string> = {
  CAPITAL_RECEIVED: "Capital received",
  CAPITAL_REPAID: "Capital repaid",
  PURCHASE: "Stock purchase",
  EXPENSE: "Expense",
  SALE_PAYMENT: "Customer payment",
  REFUND: "Refund",
  REVERSAL: "Reversal",
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

/**
 * Why stock was adjusted by hand, stored by key. `direction` is which way
 * the reason can move stock: out, in, or either.
 */
export const stockAdjustmentReasons = {
  TESTER: { label: "Tester or sample", direction: "out" },
  DAMAGED: { label: "Damaged or broken", direction: "out" },
  LOST: { label: "Lost or stolen", direction: "out" },
  GIFT: { label: "Gift or personal use", direction: "out" },
  FOUND: { label: "Found stock", direction: "in" },
  COUNT: { label: "Stock count correction", direction: "both" },
  OTHER: { label: "Other", direction: "both" },
} as const

export type StockAdjustmentReason = keyof typeof stockAdjustmentReasons

/** The label for a stored reason; unknown keys show as they are. */
export function stockAdjustmentReasonLabel(reason: string | null) {
  if (!reason) return "—"
  return reason in stockAdjustmentReasons
    ? stockAdjustmentReasons[reason as StockAdjustmentReason].label
    : reason
}
