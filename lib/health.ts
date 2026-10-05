import { formatCount } from "@/lib/format"

// Business health: a handful of ratios, each judged against a target the
// business can change. Nothing here queries the database; the figures come
// in through `HealthInputs`.

export type Status = "good" | "watch" | "action" | "none"

export type Targets = {
  /** Gross profit as a % of sales. */
  marginPct: number
  /** Money collected as a % of sales. */
  collectionPct: number
  /** Change in sales vs the previous period, in %. */
  salesTrendPct: number
  /** Most days of stock to hold at the current selling pace. */
  stockMaxDays: number
  /** All-time gross profit as a % of capital received. */
  paybackPct: number
  /** Debt from sales older than this many days counts as overdue. */
  overdueDays: number
  /** Buyers in the period with 2 or more purchases ever, in %. */
  repeatPct: number
  /** Longest a preorder should wait, in days. */
  preorderMaxDays: number
}

export const DEFAULT_TARGETS: Targets = {
  marginPct: 30,
  collectionPct: 90,
  salesTrendPct: 0,
  stockMaxDays: 60,
  paybackPct: 100,
  overdueDays: 30,
  repeatPct: 30,
  preorderMaxDays: 14,
}

export const targetKeys = Object.keys(DEFAULT_TARGETS) as (keyof Targets)[]

/** The stored targets with the defaults filled in where none was set. */
export function resolveTargets(
  row: Partial<Record<keyof Targets, number | null>> | null
): Targets {
  return Object.fromEntries(
    targetKeys.map((key) => [key, row?.[key] ?? DEFAULT_TARGETS[key]])
  ) as Targets
}

export type HealthInputs = {
  /** Figures for the selected period. */
  revenue: number
  grossProfit: number
  collected: number
  unitsSold: number
  /** Days the period covers, counted from the first sale for all time. */
  periodDays: number
  /** Sales in the period before; null when there is none (all time). */
  previousRevenue: number | null
  /** Current state, whatever the period. */
  unitsOnHand: number
  preordersWaiting: number
  oldestPreorderDays: number | null
  allTimeGrossProfit: number
  capitalReceived: number
  debt: number
  overdueDebt: number
  /** Named customers who bought in the period, and how many of them have
   * bought at least twice ever. */
  buyers: number
  repeatBuyers: number
}

export type Indicator = {
  key: keyof Targets
  label: string
  value: string
  target: string
  status: Status
  /** One line on why it has this status. */
  reason: string
  /** What the indicator means, for the tooltip. */
  explain: string
}

export type Verdict = { status: Status; title: string; detail: string }

const pct = (value: number) => `${Math.round(value)}%`
const days = (value: number) =>
  value > 0 && value < 1
    ? "Under 1 day"
    : `${formatCount(Math.round(value))} ${Math.round(value) === 1 ? "day" : "days"}`

/** Higher is better: on track at the target, watch from two thirds of it. */
export function rateHigher(value: number, target: number): Status {
  if (value >= target) return "good"
  return value >= (target * 2) / 3 ? "watch" : "action"
}

/** Lower is better: on track up to `good`, watch up to `watch`. */
export function rateLower(value: number, good: number, watch: number): Status {
  if (value <= good) return "good"
  return value <= watch ? "watch" : "action"
}

export function businessHealth(
  input: HealthInputs,
  targets: Targets
): { indicators: Indicator[]; verdict: Verdict } {
  const hasSales = input.revenue > 0
  const margin = hasSales ? (input.grossProfit / input.revenue) * 100 : null
  const collection = hasSales ? (input.collected / input.revenue) * 100 : null
  const trend =
    input.previousRevenue && input.previousRevenue > 0
      ? ((input.revenue - input.previousRevenue) / input.previousRevenue) * 100
      : null
  const perDay = input.periodDays > 0 ? input.unitsSold / input.periodDays : 0
  const cover = perDay > 0 ? input.unitsOnHand / perDay : null
  const payback =
    input.capitalReceived > 0
      ? (input.allTimeGrossProfit / input.capitalReceived) * 100
      : null
  const overdueShare =
    input.debt > 0 ? (input.overdueDebt / input.debt) * 100 : null
  const repeat =
    input.buyers > 0 ? (input.repeatBuyers / input.buyers) * 100 : null

  const stock = ((): Pick<Indicator, "value" | "status" | "reason"> => {
    if (input.unitsOnHand <= 0 && perDay === 0 && input.preordersWaiting === 0) {
      return { value: "—", status: "none", reason: "No stock or sales in this period yet." }
    }
    if (input.unitsOnHand <= 0) {
      return input.preordersWaiting > 0
        ? { value: "0 days", status: "action", reason: "Out of stock while preorders wait." }
        : { value: "0 days", status: "watch", reason: "Out of stock." }
    }
    if (cover === null) {
      return { value: "—", status: "none", reason: "No sales in this period to measure the pace." }
    }
    if (cover < 7) {
      return { value: days(cover), status: "watch", reason: "Stock runs out within a week." }
    }
    const status = rateLower(cover, targets.stockMaxDays, targets.stockMaxDays * 2)
    return {
      value: days(cover),
      status,
      reason:
        status === "good"
          ? "Stock moves at a healthy pace."
          : "Money is sitting in slow-moving stock.",
    }
  })()

  const indicators: Indicator[] = [
    {
      key: "marginPct",
      label: "Gross margin",
      value: margin === null ? "—" : pct(margin),
      target: `Target ${pct(targets.marginPct)} or more`,
      status: margin === null ? "none" : rateHigher(margin, targets.marginPct),
      reason:
        margin === null
          ? "No sales in this period."
          : `${pct(margin)} of every sale is profit after stock costs.`,
      explain:
        "Profit after what the stock cost you, as a share of sales. Low margins mean prices barely cover costs.",
    },
    {
      key: "collectionPct",
      label: "Collection rate",
      value: collection === null ? "—" : pct(collection),
      target: `Target ${pct(targets.collectionPct)} or more`,
      status:
        collection === null
          ? "none"
          : rateHigher(collection, targets.collectionPct),
      reason:
        collection === null
          ? "No sales in this period."
          : `${pct(collection)} of sales value came in as money.`,
      explain:
        "Payments and deposits received compared with sales made. Low collection means sales are turning into debts.",
    },
    {
      key: "salesTrendPct",
      label: "Sales trend",
      value: trend === null ? "—" : `${trend > 0 ? "+" : ""}${pct(trend)}`,
      target: `Target ${targets.salesTrendPct > 0 ? "+" : ""}${pct(targets.salesTrendPct)} or more`,
      status:
        trend === null
          ? "none"
          : trend >= targets.salesTrendPct
            ? "good"
            : trend >= targets.salesTrendPct - 10
              ? "watch"
              : "action",
      reason:
        trend === null
          ? "Nothing in the previous period to compare with."
          : trend >= 0
            ? "Sales are growing compared with the period before."
            : "Sales are lower than the period before.",
      explain:
        "Sales compared with the period before: the same days last month, or the previous 6 months.",
    },
    {
      key: "stockMaxDays",
      label: "Stock cover",
      ...stock,
      target: `Target ${days(targets.stockMaxDays)} or less`,
      explain:
        "How long the stock on hand lasts at the current selling pace. Too long ties up cash; too short risks running out.",
    },
    {
      key: "paybackPct",
      label: "Capital earned back",
      value: payback === null ? "—" : pct(payback),
      target: `Target ${pct(targets.paybackPct)}`,
      status: payback === null ? "none" : rateHigher(payback, targets.paybackPct),
      reason:
        payback === null
          ? "No capital recorded."
          : `Profit so far equals ${pct(payback)} of the capital put in.`,
      explain:
        "All-time gross profit compared with the capital received. At 100% the business has earned back what was put in.",
    },
    {
      key: "overdueDays",
      label: "Overdue debts",
      value: overdueShare === null ? "0%" : pct(overdueShare),
      target: `Older than ${days(targets.overdueDays)}`,
      status: overdueShare === null ? "good" : rateLower(overdueShare, 10, 30),
      reason:
        overdueShare === null
          ? "Nobody owes you."
          : `${pct(overdueShare)} of what customers owe is from sales over ${days(targets.overdueDays)} old.`,
      explain:
        "The share of customer debt that has gone unpaid for too long. On track at 10% or less, watch up to 30%.",
    },
    {
      key: "repeatPct",
      label: "Repeat customers",
      value: repeat === null ? "—" : pct(repeat),
      target: `Target ${pct(targets.repeatPct)} or more`,
      status: repeat === null ? "none" : rateHigher(repeat, targets.repeatPct),
      reason:
        repeat === null
          ? "No named customers bought in this period."
          : `${formatCount(input.repeatBuyers)} of ${formatCount(input.buyers)} buyers have bought more than once.`,
      explain:
        "Of the customers who bought in this period, the share who have bought at least twice. Walk-ins aren't counted.",
    },
    {
      key: "preorderMaxDays",
      label: "Preorder wait",
      value:
        input.oldestPreorderDays === null ? "—" : days(input.oldestPreorderDays),
      target: `Target ${days(targets.preorderMaxDays)} or less`,
      status:
        input.oldestPreorderDays === null
          ? "good"
          : rateLower(
              input.oldestPreorderDays,
              targets.preorderMaxDays,
              targets.preorderMaxDays * 2
            ),
      reason:
        input.oldestPreorderDays === null
          ? "No one is waiting."
          : `The longest-waiting preorder was taken ${days(input.oldestPreorderDays)} ago.`,
      explain:
        "How long the oldest waiting preorder has been open. Long waits risk losing the customer.",
    },
  ]

  return { indicators, verdict: verdictFor(indicators) }
}

/** On track simply because nothing is owed or waiting; not proof on its own. */
const absenceOnly = new Set<keyof Targets>(["overdueDays", "preorderMaxDays"])

function verdictFor(indicators: Indicator[]): Verdict {
  const rated = indicators.filter((indicator) => indicator.status !== "none")
  const action = rated.filter((indicator) => indicator.status === "action")
  const watch = rated.filter((indicator) => indicator.status === "watch")
  const good = rated.length - action.length - watch.length
  const names = (list: Indicator[]) =>
    list.map((indicator) => indicator.label.toLowerCase()).join(", ")

  if (rated.every((indicator) => absenceOnly.has(indicator.key))) {
    return {
      status: "none",
      title: "Not enough data yet",
      detail: "Record sales, payments and capital to see how the business is doing.",
    }
  }
  if (action.length >= 3) {
    return {
      status: "action",
      title: "At risk",
      detail: `${action.length} indicators need action: ${names(action)}.`,
    }
  }
  if (action.length > 0 || watch.length > 0) {
    return {
      status: action.length > 0 ? "action" : "watch",
      title: "Needs attention",
      detail: [
        action.length > 0 && `Act on ${names(action)}.`,
        watch.length > 0 && `Keep an eye on ${names(watch)}.`,
      ]
        .filter(Boolean)
        .join(" "),
    }
  }
  return {
    status: "good",
    title: "Doing well",
    detail: `All ${good} indicators with data are on track.`,
  }
}
