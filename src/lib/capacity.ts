export const DEFAULT_CAPACITY = 4
export const MIN_CAPACITY = 1
export const MAX_CAPACITY = 20

/** Kate always takes seat 1 and is never stored as a booking. */
export const HOST_SEATS = 1

export type DayStatus = "closed" | "open" | "full"

export function bookedCount(guestBookings: number): number {
  return HOST_SEATS + guestBookings
}

export function spotsLeft(capacity: number, guestBookings: number): number {
  return capacity - HOST_SEATS - guestBookings
}

export function isFull(capacity: number, guestBookings: number): boolean {
  return spotsLeft(capacity, guestBookings) <= 0
}

export function statusFor(
  isOpen: boolean,
  capacity: number,
  guestBookings: number,
): DayStatus {
  if (!isOpen) return "closed"
  return isFull(capacity, guestBookings) ? "full" : "open"
}

export function countLabel(capacity: number, guestBookings: number): string {
  return `${bookedCount(guestBookings)}/${capacity}`
}

export function parseCapacity(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim())
  if (!Number.isInteger(parsed)) return null
  if (parsed < MIN_CAPACITY || parsed > MAX_CAPACITY) return null
  return parsed
}
