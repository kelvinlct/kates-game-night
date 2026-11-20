import { and, asc, eq, gte, lte } from "drizzle-orm"
import { getDb } from "@/db"
import { booking, gameNight, user } from "@/db/schema"
import {
  DEFAULT_CAPACITY,
  countLabel,
  statusFor,
} from "@/lib/capacity"
import {
  dayOfMonth,
  formatLongDate,
  formatMonthTitle,
  isPastDate,
  monthGrid,
  monthKey,
  monthRange,
  shiftMonth,
} from "@/lib/dates"
import { firstName } from "@/lib/names"
import { bookModeFor } from "@/server/session"
import type { AdminUser, DayView, Viewer } from "@/lib/types"

type StoredBooking = { id: string; name: string; userId: string | null }

type StoredNight = {
  id: string
  date: string
  isOpen: boolean
  capacity: number
  bookings: StoredBooking[]
}

function placeholder(date: string, today: string): DayView {
  return {
    date,
    inMonth: false,
    isPast: isPastDate(date, today),
    isToday: date === today,
    stored: false,
    status: "closed",
    capacity: DEFAULT_CAPACITY,
    guestCount: 0,
    label: null,
    bookings: [],
    viewerBooked: false,
  }
}

function toDayView(
  date: string,
  night: StoredNight | undefined,
  today: string,
  viewer: Viewer | null,
  inMonth: boolean,
): DayView {
  const guestCount = night?.bookings.length ?? 0
  const capacity = night?.capacity ?? DEFAULT_CAPACITY
  const open = Boolean(night?.isOpen)
  const status = statusFor(open, capacity, guestCount)
  return {
    date,
    inMonth,
    isPast: isPastDate(date, today),
    isToday: date === today,
    stored: Boolean(night),
    status,
    capacity,
    guestCount,
    label: status === "closed" ? null : countLabel(capacity, guestCount),
    bookings: (night?.bookings ?? []).map((item) => ({
      id: item.id,
      firstName: firstName(item.name),
      ...(viewer?.isAdmin ? { name: item.name } : {}),
    })),
    viewerBooked: Boolean(
      viewer && night?.bookings.some((item) => item.userId === viewer.id),
    ),
  }
}

export async function getMonth(year: number, month: number, viewer: Viewer | null, today: string) {
  const { from, to } = monthRange(year, month)
  const db = getDb()
  const rows = await db
    .select({
      nightId: gameNight.id,
      date: gameNight.date,
      isOpen: gameNight.isOpen,
      capacity: gameNight.capacity,
      bookingId: booking.id,
      bookingName: booking.name,
      bookingUserId: booking.userId,
      bookingCreatedAt: booking.createdAt,
    })
    .from(gameNight)
    .leftJoin(booking, eq(booking.gameNightId, gameNight.id))
    .where(and(gte(gameNight.date, from), lte(gameNight.date, to)))
    .orderBy(asc(gameNight.date), asc(booking.createdAt))

  const nights = new Map<string, StoredNight>()
  for (const row of rows) {
    let night = nights.get(row.date)
    if (!night) {
      night = {
        id: row.nightId,
        date: row.date,
        isOpen: row.isOpen,
        capacity: row.capacity,
        bookings: [],
      }
      nights.set(row.date, night)
    }
    if (row.bookingId && row.bookingName) {
      night.bookings.push({
        id: row.bookingId,
        name: row.bookingName,
        userId: row.bookingUserId,
      })
    }
  }

  const days = monthGrid(year, month).map((cell) => {
    if (!cell.inMonth) return { ...placeholder(cell.date, today), date: cell.date }
    return toDayView(cell.date, nights.get(cell.date), today, viewer, true)
  })

  const previous = shiftMonth(year, month, -1)
  const next = shiftMonth(year, month, 1)

  return {
    year,
    month,
    label: formatMonthTitle(year, month),
    monthKey: monthKey(year, month),
    prevKey: monthKey(previous.year, previous.month),
    nextKey: monthKey(next.year, next.month),
    days,
    bookMode: bookModeFor(viewer),
    viewerName: viewer?.name ?? null,
    isAdmin: Boolean(viewer?.isAdmin),
  }
}

export async function listUsers(): Promise<AdminUser[]> {
  const rows = await getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      verified: user.verified,
    })
    .from(user)
    .orderBy(asc(user.name))
  return rows
}

export { dayOfMonth, formatLongDate }
