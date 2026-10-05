// Dates the user picks are calendar days in Tanzania, stored as midnight EAT.

export const TIME_ZONE = "Africa/Dar_es_Salaam"
const UTC_OFFSET = "+03:00"

const isoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Today in Tanzania as "YYYY-MM-DD". */
export function todayIso() {
  return isoDay.format(new Date())
}

/** "YYYY-MM-DD" -> the start of that day in Tanzania. */
export function dayToDate(day: string) {
  return new Date(`${day}T00:00:00${UTC_OFFSET}`)
}

const display = new Intl.DateTimeFormat("en-TZ", {
  dateStyle: "medium",
  timeZone: TIME_ZONE,
})

/** "4 Oct 2026" */
export function formatDate(date: Date) {
  return display.format(date)
}

const isoOf = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

/** The Tanzanian midnight that ends the given day. */
const endOfDay = (day: string) =>
  new Date(dayToDate(day).getTime() + 24 * 60 * 60 * 1000)

/**
 * The same day `months` months earlier, kept within that month (31 March
 * minus one month is 28 or 29 February).
 */
function monthsBefore(day: string, months: number) {
  const [year, month, date] = day.split("-").map(Number)
  const index = year * 12 + (month - 1) - months
  const y = Math.floor(index / 12)
  const m = (index % 12) + 1
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return isoOf(y, m, Math.min(date, lastDay))
}

export const periods = ["month", "6months", "all"] as const
export type Period = (typeof periods)[number]

type Range = { from: Date; to: Date }

/**
 * The [from, to) range a period covers up to today, and the range before it
 * to compare against (none for all time):
 * - month: this month so far vs the same days last month;
 * - 6months: the last six months vs the six months before.
 */
export function periodRanges(
  period: Period,
  today = todayIso()
): { current: Range; previous: Range | null } {
  const [year, month] = today.split("-").map(Number)
  if (period === "all") {
    return { current: { from: new Date(0), to: endOfDay(today) }, previous: null }
  }
  if (period === "6months") {
    const start = monthsBefore(today, 6)
    return {
      current: { from: endOfDay(start), to: endOfDay(today) },
      previous: {
        from: endOfDay(monthsBefore(today, 12)),
        to: endOfDay(start),
      },
    }
  }
  const lastMonth = monthsBefore(today, 1)
  const [prevYear, prevMonth] = lastMonth.split("-").map(Number)
  return {
    current: { from: dayToDate(isoOf(year, month, 1)), to: endOfDay(today) },
    previous: {
      from: dayToDate(isoOf(prevYear, prevMonth, 1)),
      // On the 31st, last month's stretch stops at its own last day.
      to: endOfDay(lastMonth),
    },
  }
}
