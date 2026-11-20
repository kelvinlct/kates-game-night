import type { DayStatus } from "@/lib/capacity"

export type BookMode = "guest" | "answer" | "one-click"

export type Viewer = {
  id: string
  name: string
  email: string
  verified: boolean
  isAdmin: boolean
}

export type PublicBooking = {
  id: string
  firstName: string
  /** Full name is included only for admins. */
  name?: string
  /** This browser or signed-in user can take this row off the list. */
  canRemove: boolean
}

export type DayView = {
  date: string
  inMonth: boolean
  isPast: boolean
  isToday: boolean
  stored: boolean
  status: DayStatus
  capacity: number
  guestCount: number
  label: string | null
  /** Effective HH:mm, stored value or the weekday/weekend default. */
  startTime: string
  /** Spoken label for open and full nights. Closed nights omit it. */
  timeLabel: string | null
  /** What is being played. Defaults to TBD. */
  game: string
  bookings: PublicBooking[]
  viewerBooked: boolean
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export type AdminUser = {
  id: string
  name: string
  email: string
  verified: boolean
}
