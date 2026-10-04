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
