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
