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

/**
 * This month so far and the same stretch of last month, as [from, to) pairs
 * of Tanzanian midnights. On the 31st, last month's stretch stops at its own
 * last day.
 */
export function monthToDate(today = todayIso()) {
  const [year, month, day] = today.split("-").map(Number)
  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  const nextDay = (y: number, m: number, d: number) =>
    new Date(dayToDate(iso(y, m, d)).getTime() + 24 * 60 * 60 * 1000)

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const prevMonthDays = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()

  return {
    current: { from: dayToDate(iso(year, month, 1)), to: nextDay(year, month, day) },
    previous: {
      from: dayToDate(iso(prevYear, prevMonth, 1)),
      to: nextDay(prevYear, prevMonth, Math.min(day, prevMonthDays)),
    },
  }
}
