export const TIME_ZONE = "America/Toronto"

const MONTH_RE = /^(\d{4})-(\d{2})$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export type MonthParts = { year: number; month: number }

export function todayInToronto(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) {
    throw new Error("Could not format the Toronto date")
  }
  return `${year}-${month}-${day}`
}

export function isRealDate(value: string): boolean {
  const match = DATE_RE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function isPastDate(isoDate: string, today: string): boolean {
  return isoDate < today
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

export function parseMonth(value: string | undefined, today: string): MonthParts {
  const match = value ? MONTH_RE.exec(value) : null
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { year, month }
    }
  }
  return {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }
}

export function shiftMonth(year: number, month: number, delta: number): MonthParts {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

export type CalendarCell = { date: string; inMonth: boolean }

function isoFromUTC(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Sunday-first month grid. Dates are plain YYYY-MM-DD strings, not instants. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: CalendarCell[] = []

  for (let index = 0; index < firstWeekday; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - (firstWeekday - index)))
    cells.push({ date: isoFromUTC(date), inMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      date: isoFromUTC(new Date(Date.UTC(year, month - 1, day))),
      inMonth: true,
    })
  }

  while (cells.length % 7 !== 0) {
    const [yearPart, monthPart, dayPart] = cells[cells.length - 1].date.split("-").map(Number)
    const next = new Date(Date.UTC(yearPart, monthPart - 1, dayPart + 1))
    cells.push({ date: isoFromUTC(next), inMonth: false })
  }

  return cells
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const key = monthKey(year, month)
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` }
}

export function formatMonthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)))
}

export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10))
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
