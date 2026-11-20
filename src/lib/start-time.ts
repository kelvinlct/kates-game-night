export const WEEKDAY_START = "19:00"
export const WEEKEND_START = "14:30"

/** Calendar weekday of a YYYY-MM-DD date. 0 is Sunday. Uses the date itself, not a timezone conversion. */
export function weekdayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function isWeekend(isoDate: string): boolean {
  const day = weekdayIndex(isoDate)
  return day === 0 || day === 6
}

/** Monday–Friday 7:00pm, Saturday–Sunday 2:30pm, as America/Toronto local time-of-day. */
export function defaultStartTime(isoDate: string): string {
  return isWeekend(isoDate) ? WEEKEND_START : WEEKDAY_START
}

export function parseStartTime(value: unknown): string | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(value ?? "").trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${match[1]}:${match[2]}`
}

export function effectiveStartTime(stored: string | null | undefined, isoDate: string): string {
  return parseStartTime(stored) ?? defaultStartTime(isoDate)
}

/** 19:00 → 7:00pm, 14:30 → 2:30pm. */
export function formatStartTime(hhmm: string): string {
  const parsed = parseStartTime(hhmm)
  if (!parsed) return hhmm
  const hour24 = Number(parsed.slice(0, 2))
  const minute = parsed.slice(3, 5)
  const suffix = hour24 >= 12 ? "pm" : "am"
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${minute}${suffix}`
}

export function formatNightHeading(isoDate: string, timeLabel: string | null): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel
}
