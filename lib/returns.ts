// The money side of returning items from a completed sale, in whole
// shillings. Shared by the return form's preview and the ledger, so what the
// form shows is what gets recorded.

export type ReturnTotals = {
  /** What the returned items were worth on the sale, after its discount. */
  credit: number
  /** The sale's total once they're gone. */
  newTotal: number
  /** Paid back to the customer: whatever they paid beyond the new total. */
  refund: number
  /** Still owed on the sale afterwards. */
  balanceAfter: number
}

/**
 * A discount is shared across the items by value, so returning half of what
 * was bought takes off half the total. Returning everything takes off the
 * whole total. The refund is never more than was paid; when the customer
 * still owed money, the credit clears that debt first.
 */
export function returnTotals({
  total,
  subtotal,
  paid,
  returnedValue,
  returnsEverything,
}: {
  /** The sale total, after its discount. */
  total: number
  /** The items' value before the discount. */
  subtotal: number
  /** Paid on the sale so far, net of earlier refunds. */
  paid: number
  /** The returned units at the prices charged, before the discount. */
  returnedValue: number
  returnsEverything: boolean
}): ReturnTotals {
  const credit = returnsEverything
    ? total
    : subtotal > 0
      ? Math.min(Math.round((returnedValue * total) / subtotal), total)
      : 0
  const newTotal = total - credit
  const refund = Math.max(paid - newTotal, 0)
  return {
    credit,
    newTotal,
    refund,
    balanceAfter: Math.max(newTotal - paid, 0),
  }
}
