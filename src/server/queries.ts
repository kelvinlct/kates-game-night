import { and, asc, desc, eq, gte, lte } from "drizzle-orm"
import { getDb } from "@/db"
import { booking, bookingEvent, gameNight, user } from "@/db/schema"
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
import { cookies } from "next/headers"
import { canRemoveOwnBooking, hashGuestToken, GUEST_COOKIE } from "@/lib/join"
import { firstName, shownBookingName } from "@/lib/names"
import { DEFAULT_GAME, gameLabel } from "@/lib/game"
import {
  HISTORY_LIMIT,
  actionLabel,
  formatTorontoTimestamp,
  kindLabel,
  type BookingAction,
  type PersonKind,
} from "@/lib/history"
import { defaultStartTime, effectiveStartTime, formatStartTime } from "@/lib/start-time"
import { bookModeFor } from "@/server/session"
import type { AdminUser, DayView, Viewer } from "@/lib/types"

type StoredBooking = {
  id: string
  name: string
  userId: string | null
  userName: string | null
  guestTokenHash: string | null
}

type StoredNight = {
  id: string
  date: string
  isOpen: boolean
  capacity: number
  startTime: string | null
  game: string
  bookings: StoredBooking[]
}

function defaultStartForPlaceholder(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? defaultStartTime(date) : "19:00"
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
    startTime: defaultStartForPlaceholder(date),
    timeLabel: null,
    game: DEFAULT_GAME,
    bookings: [],
    viewerBooked: false,
  }
}

function toDayView(
  date: string,
  night: StoredNight | undefined,
  today: string,
  viewer: Viewer | null,
  guestHash: string | null,
  inMonth: boolean,
): DayView {
  const guestCount = night?.bookings.length ?? 0
  const capacity = night?.capacity ?? DEFAULT_CAPACITY
  const open = Boolean(night?.isOpen)
  const status = statusFor(open, capacity, guestCount)
  const startTime = effectiveStartTime(night?.startTime, date)
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
    startTime,
    timeLabel: status === "closed" ? null : formatStartTime(startTime),
    game: gameLabel(night?.game),
    bookings: (night?.bookings ?? []).map((item) => {
      const name = shownBookingName(item.name, item.userId ? item.userName : null)
      return {
        id: item.id,
        firstName: firstName(name),
        canRemove: canRemoveOwnBooking({
          bookingUserId: item.userId,
          viewerId: viewer?.id ?? null,
          storedTokenHash: item.guestTokenHash,
          presentedTokenHash: guestHash,
        }),
        ...(viewer?.isAdmin ? { name } : {}),
      }
    }),
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
      startTime: gameNight.startTime,
      game: gameNight.game,
      bookingId: booking.id,
      bookingName: booking.name,
      bookingUserId: booking.userId,
      bookingUserName: user.name,
      guestTokenHash: booking.guestTokenHash,
      bookingCreatedAt: booking.createdAt,
    })
    .from(gameNight)
    .leftJoin(booking, eq(booking.gameNightId, gameNight.id))
    .leftJoin(user, eq(booking.userId, user.id))
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
        startTime: row.startTime,
        game: row.game,
        bookings: [],
      }
      nights.set(row.date, night)
    }
    if (row.bookingId && row.bookingName) {
      night.bookings.push({
        id: row.bookingId,
        name: row.bookingName,
        userId: row.bookingUserId,
        userName: row.bookingUserName,
        guestTokenHash: row.guestTokenHash,
      })
    }
  }

  const guestToken = (await cookies()).get(GUEST_COOKIE)?.value
  const guestHash = guestToken ? hashGuestToken(guestToken) : null
  const days = monthGrid(year, month).map((cell) => {
    if (!cell.inMonth) return { ...placeholder(cell.date, today), date: cell.date }
    return toDayView(cell.date, nights.get(cell.date), today, viewer, guestHash, true)
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

export type HistoryEntry = {
  id: string
  who: string
  action: string
  night: string
  when: string
}

function asAction(value: string): BookingAction {
  return value === "removed" ? "removed" : "joined"
}

function asKind(value: string): PersonKind {
  return value === "guest" ? "guest" : "signed-in"
}

export async function listBookingHistory(limit = HISTORY_LIMIT): Promise<HistoryEntry[]> {
  const rows = await getDb()
    .select({
      id: bookingEvent.id,
      action: bookingEvent.action,
      nightDate: bookingEvent.nightDate,
      personName: bookingEvent.personName,
      personKind: bookingEvent.personKind,
      actorName: bookingEvent.actorName,
      createdAt: bookingEvent.createdAt,
    })
    .from(bookingEvent)
    .orderBy(desc(bookingEvent.createdAt))
    .limit(limit)

  return rows.map((row) => {
    const action = asAction(row.action)
    const kind = asKind(row.personKind)
    return {
      id: row.id,
      who: `${row.personName} · ${kindLabel(kind)}`,
      action: actionLabel({ action, actorName: row.actorName }),
      night: formatLongDate(row.nightDate),
      when: formatTorontoTimestamp(row.createdAt),
    }
  })
}

export { dayOfMonth, formatLongDate }
