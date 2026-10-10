import { describe, expect, it } from "vitest"

import { dayToDate, periodRanges } from "@/lib/dates"

const iso = (date: Date) => date.toISOString()

describe("dayToDate", () => {
  it("is midnight in Tanzania, three hours ahead of UTC", () => {
    expect(iso(dayToDate("2026-10-10"))).toBe("2026-10-09T21:00:00.000Z")
  })
})

describe("periodRanges", () => {
  it("compares this month so far with the same days last month", () => {
    const { current, previous } = periodRanges("month", "2026-10-10")
    expect(iso(current.from)).toBe(iso(dayToDate("2026-10-01")))
    expect(iso(current.to)).toBe(iso(dayToDate("2026-10-11")))
    expect(iso(previous!.from)).toBe(iso(dayToDate("2026-09-01")))
    expect(iso(previous!.to)).toBe(iso(dayToDate("2026-09-11")))
  })

  it("stops last month's stretch at its own last day", () => {
    const { previous } = periodRanges("month", "2026-03-31")
    expect(iso(previous!.from)).toBe(iso(dayToDate("2026-02-01")))
    expect(iso(previous!.to)).toBe(iso(dayToDate("2026-03-01")))
  })

  it("handles the turn of the year", () => {
    const { previous } = periodRanges("month", "2026-01-15")
    expect(iso(previous!.from)).toBe(iso(dayToDate("2025-12-01")))
  })

  it("compares the last six months with the six before", () => {
    const { current, previous } = periodRanges("6months", "2026-10-10")
    expect(iso(current.from)).toBe(iso(dayToDate("2026-04-11")))
    expect(iso(current.to)).toBe(iso(dayToDate("2026-10-11")))
    expect(iso(previous!.from)).toBe(iso(dayToDate("2025-10-11")))
    expect(iso(previous!.to)).toBe(iso(current.from))
  })

  it("has nothing to compare all time with", () => {
    const { current, previous } = periodRanges("all", "2026-10-10")
    expect(current.from.getTime()).toBe(0)
    expect(previous).toBeNull()
  })
})
