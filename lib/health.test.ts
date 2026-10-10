import { describe, expect, it } from "vitest"

import {
  DEFAULT_TARGETS,
  businessHealth,
  rateHigher,
  rateLower,
  resolveTargets,
  type HealthInputs,
  type Indicator,
} from "@/lib/health"

// A business doing well on every indicator; tests change one thing at a time.
const healthy: HealthInputs = {
  revenue: 1_000_000,
  grossProfit: 400_000,
  collected: 950_000,
  unitsSold: 30,
  periodDays: 30,
  previousRevenue: 900_000,
  unitsOnHand: 30,
  preordersWaiting: 0,
  oldestPreorderDays: null,
  allTimeGrossProfit: 2_000_000,
  capitalReceived: 1_500_000,
  debt: 50_000,
  overdueDebt: 0,
  buyers: 10,
  repeatBuyers: 5,
}

const indicator = (input: Partial<HealthInputs>, key: Indicator["key"]) =>
  businessHealth({ ...healthy, ...input }, DEFAULT_TARGETS).indicators.find(
    (item) => item.key === key
  )!

describe("resolveTargets", () => {
  it("uses the defaults when nothing is stored", () => {
    expect(resolveTargets(null)).toEqual(DEFAULT_TARGETS)
  })

  it("keeps stored targets and fills in the rest", () => {
    const targets = resolveTargets({ marginPct: 45, collectionPct: null })
    expect(targets.marginPct).toBe(45)
    expect(targets.collectionPct).toBe(DEFAULT_TARGETS.collectionPct)
  })

  it("keeps a stored zero instead of the default", () => {
    expect(resolveTargets({ salesTrendPct: 0, marginPct: 0 }).marginPct).toBe(0)
  })
})

describe("rateHigher", () => {
  it("is good at the target, watch from two thirds of it, action below", () => {
    expect(rateHigher(30, 30)).toBe("good")
    expect(rateHigher(20, 30)).toBe("watch")
    expect(rateHigher(19.9, 30)).toBe("action")
  })
})

describe("rateLower", () => {
  it("is good up to `good`, watch up to `watch`, action above", () => {
    expect(rateLower(60, 60, 120)).toBe("good")
    expect(rateLower(120, 60, 120)).toBe("watch")
    expect(rateLower(121, 60, 120)).toBe("action")
  })
})

describe("businessHealth", () => {
  it("rates a healthy business as doing well", () => {
    const { indicators, verdict } = businessHealth(healthy, DEFAULT_TARGETS)
    expect(indicators.every((item) => item.status === "good")).toBe(true)
    expect(verdict).toMatchObject({ status: "good", title: "Doing well" })
  })

  it("has no verdict for a new business with nothing recorded", () => {
    const { verdict } = businessHealth(
      {
        ...healthy,
        revenue: 0,
        grossProfit: 0,
        collected: 0,
        unitsSold: 0,
        previousRevenue: null,
        unitsOnHand: 0,
        allTimeGrossProfit: 0,
        capitalReceived: 0,
        debt: 0,
        buyers: 0,
        repeatBuyers: 0,
      },
      DEFAULT_TARGETS
    )
    expect(verdict.status).toBe("none")
  })

  it("computes margin and collection as shares of sales", () => {
    expect(indicator({}, "marginPct").value).toBe("40%")
    expect(indicator({ collected: 500_000 }, "collectionPct")).toMatchObject({
      value: "50%",
      status: "action",
    })
  })

  it("shows the sales trend with a sign and compares it to the target", () => {
    expect(indicator({}, "salesTrendPct").value).toBe("+11%")
    expect(indicator({ previousRevenue: 1_050_000 }, "salesTrendPct").status).toBe(
      "watch"
    )
    expect(indicator({ previousRevenue: 2_000_000 }, "salesTrendPct")).toMatchObject({
      value: "-50%",
      status: "action",
    })
    expect(indicator({ previousRevenue: null }, "salesTrendPct").status).toBe("none")
  })

  describe("stock cover", () => {
    it("is the days the stock lasts at the current selling pace", () => {
      // 30 units sold in 30 days, 30 on hand: 30 days of cover.
      expect(indicator({}, "stockMaxDays")).toMatchObject({
        value: "30 days",
        status: "good",
      })
    })

    it("needs action when out of stock while preorders wait", () => {
      expect(
        indicator({ unitsOnHand: 0, preordersWaiting: 2 }, "stockMaxDays").status
      ).toBe("action")
    })

    it("warns when stock runs out within a week", () => {
      expect(indicator({ unitsOnHand: 5 }, "stockMaxDays")).toMatchObject({
        value: "5 days",
        status: "watch",
      })
    })

    it("flags slow-moving stock past the target", () => {
      expect(indicator({ unitsOnHand: 150 }, "stockMaxDays").status).toBe("action")
    })
  })

  it("treats no debt and no waiting preorders as on track", () => {
    expect(indicator({ debt: 0, overdueDebt: 0 }, "overdueDays").status).toBe("good")
    expect(indicator({}, "preorderMaxDays").status).toBe("good")
  })

  it("judges overdue debt by its share of all debt", () => {
    expect(
      indicator({ debt: 100_000, overdueDebt: 20_000 }, "overdueDays").status
    ).toBe("watch")
    expect(
      indicator({ debt: 100_000, overdueDebt: 50_000 }, "overdueDays").status
    ).toBe("action")
  })

  it("is at risk when three or more indicators need action", () => {
    const { verdict } = businessHealth(
      { ...healthy, grossProfit: 50_000, collected: 300_000, previousRevenue: 3_000_000 },
      DEFAULT_TARGETS
    )
    expect(verdict).toMatchObject({ status: "action", title: "At risk" })
    expect(verdict.detail).toContain("gross margin")
  })

  it("names what to act on and what to watch", () => {
    const { verdict } = businessHealth(
      { ...healthy, collected: 500_000, unitsOnHand: 5 },
      DEFAULT_TARGETS
    )
    expect(verdict.title).toBe("Needs attention")
    expect(verdict.detail).toBe(
      "Act on collection rate. Keep an eye on stock cover."
    )
  })
})
