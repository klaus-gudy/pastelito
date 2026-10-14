import { describe, expect, it } from "vitest"

import { returnTotals } from "@/lib/returns"

describe("returnTotals", () => {
  it("refunds the full value of items returned from a paid sale", () => {
    expect(
      returnTotals({
        total: 100_000,
        subtotal: 100_000,
        paid: 100_000,
        returnedValue: 40_000,
        returnsEverything: false,
      })
    ).toEqual({ credit: 40_000, newTotal: 60_000, refund: 40_000, balanceAfter: 0 })
  })

  it("shares the discount across the items by value", () => {
    // 100,000 of items with a 10,000 discount; half comes back.
    expect(
      returnTotals({
        total: 90_000,
        subtotal: 100_000,
        paid: 90_000,
        returnedValue: 50_000,
        returnsEverything: false,
      }).credit
    ).toBe(45_000)
  })

  it("clears debt before refunding anything", () => {
    expect(
      returnTotals({
        total: 100_000,
        subtotal: 100_000,
        paid: 30_000,
        returnedValue: 40_000,
        returnsEverything: false,
      })
    ).toEqual({ credit: 40_000, newTotal: 60_000, refund: 0, balanceAfter: 30_000 })
  })

  it("refunds only the part paid beyond the new total", () => {
    expect(
      returnTotals({
        total: 100_000,
        subtotal: 100_000,
        paid: 80_000,
        returnedValue: 40_000,
        returnsEverything: false,
      })
    ).toEqual({ credit: 40_000, newTotal: 60_000, refund: 20_000, balanceAfter: 0 })
  })

  it("takes the whole total off when everything comes back", () => {
    expect(
      returnTotals({
        total: 89_999,
        subtotal: 100_000,
        paid: 89_999,
        returnedValue: 100_000,
        returnsEverything: true,
      })
    ).toEqual({ credit: 89_999, newTotal: 0, refund: 89_999, balanceAfter: 0 })
  })

  it("rounds a shared discount to whole shillings", () => {
    expect(
      returnTotals({
        total: 99_000,
        subtotal: 100_000,
        paid: 0,
        returnedValue: 33_333,
        returnsEverything: false,
      }).credit
    ).toBe(33_000)
  })
})
