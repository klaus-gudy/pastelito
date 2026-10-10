import { describe, expect, it } from "vitest"

import { todayIso } from "@/lib/dates"
import { amountField, dayField, noteField } from "@/lib/validations/common"

const message = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message)

describe("amountField", () => {
  it("accepts whole shillings and ignores commas and spaces", () => {
    expect(amountField.parse("500,000")).toBe("500000")
    expect(amountField.parse(" 1 250 ")).toBe("1250")
  })

  it("rejects decimals, negatives, zero and blanks with one message each", () => {
    expect(message(amountField.safeParse("12.50"))).toEqual([
      "Enter a whole number of shillings, like 500,000.",
    ])
    expect(message(amountField.safeParse("-5"))).toHaveLength(1)
    expect(message(amountField.safeParse("0"))).toEqual(["Enter the amount."])
    expect(message(amountField.safeParse(""))).toEqual(["Enter the amount."])
  })

  it("rejects amounts too large to store", () => {
    expect(amountField.safeParse("1234567890123").success).toBe(false)
  })
})

describe("dayField", () => {
  it("accepts today and past days", () => {
    expect(dayField.safeParse(todayIso()).success).toBe(true)
    expect(dayField.safeParse("2024-02-29").success).toBe(true)
  })

  it("rejects days that don't exist", () => {
    expect(dayField.safeParse("2026-02-31").success).toBe(false)
    expect(dayField.safeParse("2026-13-01").success).toBe(false)
    expect(dayField.safeParse("10/10/2026").success).toBe(false)
  })

  it("rejects future days", () => {
    expect(message(dayField.safeParse("2999-01-01"))).toEqual([
      "The date can't be in the future.",
    ])
  })
})

describe("noteField", () => {
  it("trims notes and turns empty ones into null", () => {
    expect(noteField.parse("  thanks  ")).toBe("thanks")
    expect(noteField.parse("   ")).toBeNull()
    expect(noteField.parse(undefined)).toBeNull()
  })
})
