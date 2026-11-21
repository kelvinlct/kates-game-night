"use server"

import { randomBytes } from "node:crypto"
import { and, asc, eq, gt, lt } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { getDb, type AppDatabase } from "@/db"
import { answerAttempt, booking, gameNight, user, waitlist } from "@/db/schema"
import { recordBookingEvent } from "@/server/booking-events"
import { adminPlacement, peopleToPromote, selfPlacement } from "@/lib/waitlist"
import { DEFAULT_CAPACITY, isFull, parseCapacity } from "@/lib/capacity"
import { isPastDate, isRealDate, todayInToronto } from "@/lib/dates"
import {
  GUEST_COOKIE,
  canRemoveOwnBooking,
  hashGuestToken,
  shouldMarkVerified,
} from "@/lib/join"
import { accountDisplayName, cleanName, displayName, guestBookingRename } from "@/lib/names"
import { getAuth } from "@/lib/auth"
import { DEFAULT_GAME, parseGame } from "@/lib/game"
import { DEFAULT_LOCATION, parseLocation } from "@/lib/location"
import { defaultStartTime, parseStartTime } from "@/lib/start-time"
import {
  FAILURE_RETENTION_MS,
  checkSecurityAnswer,
  lockoutFromFailures,
  lockoutMessage,
} from "@/lib/security"
import type { ActionResult } from "@/lib/types"
import type { PersonKind } from "@/lib/history"
import { clientIp, getViewer } from "@/server/session"

function refresh() {
  revalidatePath("/")
  revalidatePath("/admin")
  revalidatePath("/admin/history")
  revalidatePath("/admin/users")
}

function failure(error: unknown): ActionResult {
  console.error(error instanceof Error ? error.message : "request failed")
  return { ok: false, error: "Something went wrong. Try again." }
}

async function failureTimes(ip: string): Promise<number[]> {
  const since = new Date(Date.now() - FAILURE_RETENTION_MS)
  const rows = await getDb()
    .select({ createdAt: answerAttempt.createdAt })
    .from(answerAttempt)
    .where(and(eq(answerAttempt.ip, ip), gt(answerAttempt.createdAt, since)))
    .orderBy(asc(answerAttempt.createdAt))
  return rows.map((row) => row.createdAt.getTime())
}

async function recordFailure(ip: string) {
  const db = getDb()
  const cutoff = new Date(Date.now() - FAILURE_RETENTION_MS)
  await db.insert(answerAttempt).values({ id: crypto.randomUUID(), ip })
  await db.delete(answerAttempt).where(lt(answerAttempt.createdAt, cutoff))
}

async function clearFailures(ip: string) {
  await getDb().delete(answerAttempt).where(eq(answerAttempt.ip, ip))
}

type NightTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0]

async function promoteOpenSeats(
  tx: NightTx,
  night: { id: string; date: string; capacity: number },
) {
  const seated = await tx
    .select({ id: booking.id })
    .from(booking)
    .where(eq(booking.gameNightId, night.id))
  const waiting = await tx
    .select({
      id: waitlist.id,
      userId: waitlist.userId,
      name: waitlist.name,
      guestTokenHash: waitlist.guestTokenHash,
    })
    .from(waitlist)
    .where(eq(waitlist.gameNightId, night.id))
    .orderBy(asc(waitlist.createdAt), asc(waitlist.id))
    .for("update")
  for (const person of peopleToPromote(night.capacity, seated.length, waiting)) {
    await tx.insert(booking).values({
      id: crypto.randomUUID(),
      gameNightId: night.id,
      userId: person.userId,
      guestTokenHash: person.guestTokenHash,
      name: person.name,
    })
    await tx.delete(waitlist).where(eq(waitlist.id, person.id))
    await recordBookingEvent(tx, {
      action: "wait_promoted",
      nightDate: night.date,
      personName: person.name,
      personKind: person.userId ? "signed-in" : "guest",
      personUserId: person.userId,
      actorName: null,
      actorUserId: null,
    })
  }
}

export async function bookSpot(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const date = String(formData.get("date") ?? "")
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }

    const viewer = await getViewer()
    const needsAnswer = !viewer?.isAdmin && (!viewer || !viewer.verified)
    const name = viewer
      ? displayName(viewer.name)
      : cleanName(String(formData.get("name") ?? ""))
    if (!name) {
      return { ok: false, error: viewer ? "Update your name in the header first." : "Add your name." }
    }

    let answerCorrect = false
    if (needsAnswer) {
      const answer = String(formData.get("answer") ?? "")
      if (!answer.trim()) return { ok: false, error: "Enter Kate's last name." }
      const ip = await clientIp()
      const lockout = lockoutFromFailures(await failureTimes(ip), Date.now())
      if (lockout.locked) {
        return { ok: false, error: lockoutMessage(lockout.waitMs) }
      }
      answerCorrect = checkSecurityAnswer(answer)
      if (!answerCorrect) {
        await recordFailure(ip)
        return { ok: false, error: "That's not the right answer." }
      }
      await clearFailures(ip)
    }

    const markVerified = shouldMarkVerified({
      signedIn: Boolean(viewer),
      alreadyVerified: Boolean(viewer?.verified),
      answerCorrect,
    })
    const guest = viewer ? null : await guestCredential()

    const today = todayInToronto()
    const result = await getDb().transaction(async (tx) => {
      const [night] = await tx
        .select()
        .from(gameNight)
        .where(eq(gameNight.date, date))
        .for("update")
        .limit(1)

      if (!night || !night.isOpen) {
        return { ok: false as const, error: "That night is closed." }
      }
      if (isPastDate(night.date, today)) {
        return { ok: false as const, error: "That night has already passed." }
      }

      const existing = await tx
        .select({ id: booking.id, userId: booking.userId, guestTokenHash: booking.guestTokenHash })
        .from(booking)
        .where(eq(booking.gameNightId, night.id))
      const queued = await tx
        .select({ id: waitlist.id, userId: waitlist.userId, guestTokenHash: waitlist.guestTokenHash })
        .from(waitlist)
        .where(eq(waitlist.gameNightId, night.id))
      const sameGuest = (hash: string | null) => Boolean(guest && hash && hash === guest.hash)
      const placement = selfPlacement({
        open: night.isOpen,
        past: isPastDate(night.date, today),
        full: isFull(night.capacity, existing.length),
        waitlistEnabled: night.waitlistEnabled,
        alreadyBooked: viewer
          ? existing.some((item) => item.userId === viewer.id)
          : existing.some((item) => sameGuest(item.guestTokenHash)),
        alreadyWaiting: viewer
          ? queued.some((item) => item.userId === viewer.id)
          : queued.some((item) => sameGuest(item.guestTokenHash)),
      })
      if (!placement.ok) return placement

      if (markVerified && viewer) {
        await tx.update(user).set({ verified: true }).where(eq(user.id, viewer.id))
      }

      const row = {
        id: crypto.randomUUID(),
        gameNightId: night.id,
        userId: viewer?.id ?? null,
        guestTokenHash: guest?.hash ?? null,
        name,
      }
      const waiting = placement.place === "wait"
      await tx.insert(waiting ? waitlist : booking).values(row)
      await recordBookingEvent(tx, {
        action: waiting ? "wait_joined" : "joined",
        nightDate: night.date,
        personName: name,
        personKind: viewer ? "signed-in" : "guest",
        personUserId: viewer?.id ?? null,
        actorName: null,
        actorUserId: null,
      })
      return { ok: true as const, waiting }
    })

    if (result.ok) {
      if (guest?.fresh) await rememberGuest(guest.token)
      refresh()
    }
    return result
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null
    if (code === "23505") {
      return { ok: false, error: "You're already in." }
    }
    return failure(error)
  }
}

async function guestCredential(): Promise<{ token: string; hash: string; fresh: boolean }> {
  const jar = await cookies()
  const existing = jar.get(GUEST_COOKIE)?.value
  if (existing && existing.length >= 32) {
    return { token: existing, hash: hashGuestToken(existing), fresh: false }
  }
  const token = randomBytes(32).toString("base64url")
  return { token, hash: hashGuestToken(token), fresh: true }
}

async function rememberGuest(token: string) {
  const jar = await cookies()
  jar.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  })
}

async function presentedGuestHash(): Promise<string | null> {
  const token = (await cookies()).get(GUEST_COOKIE)?.value
  return token ? hashGuestToken(token) : null
}

async function requireAdminViewer() {
  const viewer = await getViewer()
  if (!viewer?.isAdmin) return null
  return viewer
}

export async function updateDisplayName(name: string): Promise<ActionResult> {
  try {
    const viewer = await getViewer()
    if (!viewer) return { ok: false, error: "Sign in first." }
    const cleaned = accountDisplayName(name)
    if (!cleaned.ok) return cleaned
    await getAuth().api.updateUser({
      body: { name: cleaned.name },
      headers: await headers(),
    })
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

async function commitAdminAdd(input: {
  date: string
  admin: { id: string; name: string; email: string }
  name: string
  userId: string | null
  personKind: PersonKind
}): Promise<ActionResult> {
  const today = todayInToronto()
  const actorName = displayName(input.admin.name) ?? input.admin.email
  const result = await getDb().transaction(async (tx) => {
    const [night] = await tx
      .select()
      .from(gameNight)
      .where(eq(gameNight.date, input.date))
      .for("update")
      .limit(1)

    const existing = night
      ? await tx
          .select({ id: booking.id, userId: booking.userId })
          .from(booking)
          .where(eq(booking.gameNightId, night.id))
      : []
    const queued = night
      ? await tx
          .select({ userId: waitlist.userId })
          .from(waitlist)
          .where(eq(waitlist.gameNightId, night.id))
      : []
    const placement = adminPlacement({
      open: Boolean(night?.isOpen),
      past: night ? isPastDate(night.date, today) : false,
      full: night ? isFull(night.capacity, existing.length) : false,
      waitlistEnabled: night ? night.waitlistEnabled : true,
      alreadyBooked: Boolean(input.userId && existing.some((item) => item.userId === input.userId)),
      alreadyWaiting: Boolean(input.userId && queued.some((item) => item.userId === input.userId)),
    })
    if (!placement.ok || !night) {
      return { ok: false as const, error: placement.ok ? "That night is closed." : placement.error }
    }

    const waiting = placement.place === "wait"
    const row = {
      id: crypto.randomUUID(),
      gameNightId: night.id,
      userId: input.userId,
      guestTokenHash: null,
      name: input.name,
    }
    if (waiting) await tx.insert(waitlist).values(row)
    else await tx.insert(booking).values(row)
    await recordBookingEvent(tx, {
      action: waiting ? "wait_joined" : "joined",
      nightDate: night.date,
      personName: input.name,
      personKind: input.personKind,
      personUserId: input.userId,
      actorName,
      actorUserId: input.admin.id,
    })
    return { ok: true as const, waiting }
  })
  if (result.ok) refresh()
  return result
}

export async function addRegisteredUser(date: string, userId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdminViewer()
    if (!admin) return { ok: false, error: "You can't do that." }
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }
    if (!userId) return { ok: false, error: "Pick someone." }
    const [person] = await getDb()
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    if (!person) return { ok: false, error: "That person isn't registered." }
    const name = displayName(person.name)
    if (!name) return { ok: false, error: "That account has no usable name." }
    return await commitAdminAdd({
      date,
      admin,
      name,
      userId: person.id,
      personKind: "signed-in",
    })
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null
    if (code === "23505") return { ok: false, error: "They're already in." }
    return failure(error)
  }
}

export async function addGuestName(date: string, rawName: string): Promise<ActionResult> {
  try {
    const admin = await requireAdminViewer()
    if (!admin) return { ok: false, error: "You can't do that." }
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }
    const name = displayName(rawName)
    if (!name) return { ok: false, error: "Use 1 to 40 characters." }
    return await commitAdminAdd({
      date,
      admin,
      name,
      userId: null,
      personKind: "guest",
    })
  } catch (error) {
    return failure(error)
  }
}

export async function setUserDisplayName(userId: string, rawName: string): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!userId) return { ok: false, error: "Missing user." }
    const parsed = accountDisplayName(rawName)
    if (!parsed.ok) return parsed
    const result = await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(user)
        .set({ name: parsed.name })
        .where(eq(user.id, userId))
        .returning({ id: user.id })
      if (updated.length === 0) return { ok: false as const, error: "That person isn't registered." }
      await tx.update(booking).set({ name: parsed.name }).where(eq(booking.userId, userId))
      await tx.update(waitlist).set({ name: parsed.name }).where(eq(waitlist.userId, userId))
      return { ok: true as const }
    })
    if (result.ok) refresh()
    return result
  } catch (error) {
    return failure(error)
  }
}

export async function renameGuestBooking(bookingId: string, rawName: string): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!bookingId) return { ok: false, error: "Missing booking." }
    const [row] = await getDb()
      .select({ id: booking.id, userId: booking.userId })
      .from(booking)
      .where(eq(booking.id, bookingId))
      .limit(1)
    const [queued] = row
      ? []
      : await getDb()
          .select({ id: waitlist.id, userId: waitlist.userId })
          .from(waitlist)
          .where(eq(waitlist.id, bookingId))
          .limit(1)
    const target = row ?? queued
    if (!target) return { ok: false, error: "That spot is already gone." }
    const parsed = guestBookingRename(target.userId, rawName)
    if (!parsed.ok) return parsed
    if (row) await getDb().update(booking).set({ name: parsed.name }).where(eq(booking.id, bookingId))
    else await getDb().update(waitlist).set({ name: parsed.name }).where(eq(waitlist.id, bookingId))
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function setNightOpen(
  date: string,
  open: boolean,
  startTime?: string,
): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }
    const db = getDb()
    if (open) {
      const requested = parseStartTime(startTime)
      await db.transaction(async (tx) => {
        await tx
          .insert(gameNight)
          .values({
            id: crypto.randomUUID(),
            date,
            isOpen: true,
            capacity: DEFAULT_CAPACITY,
            startTime: requested ?? defaultStartTime(date),
            game: DEFAULT_GAME,
            location: DEFAULT_LOCATION,
            waitlistEnabled: true,
          })
          .onConflictDoUpdate({
            target: gameNight.date,
            set: requested ? { isOpen: true, startTime: requested } : { isOpen: true },
          })
        const [night] = await tx
          .select()
          .from(gameNight)
          .where(eq(gameNight.date, date))
          .for("update")
          .limit(1)
        if (night?.isOpen) {
          await promoteOpenSeats(tx, { id: night.id, date: night.date, capacity: night.capacity })
        }
      })
    } else {
      await db.update(gameNight).set({ isOpen: false }).where(eq(gameNight.date, date))
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function setNightCapacity(date: string, capacity: number): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }
    const parsed = parseCapacity(capacity)
    if (parsed === null) {
      return { ok: false, error: "Capacity must be a whole number from 1 to 20." }
    }
    const result = await getDb().transaction(async (tx) => {
      const [night] = await tx
        .select()
        .from(gameNight)
        .where(eq(gameNight.date, date))
        .for("update")
        .limit(1)
      if (!night) return { ok: false as const, error: "Open the night before setting a capacity." }
      await tx.update(gameNight).set({ capacity: parsed }).where(eq(gameNight.id, night.id))
      if (night.isOpen) {
        await promoteOpenSeats(tx, { id: night.id, date: night.date, capacity: parsed })
      }
      return { ok: true as const }
    })
    if (result.ok) refresh()
    return result
  } catch (error) {
    return failure(error)
  }
}

export async function setNightStartTime(date: string, startTime: string): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }
    const parsed = parseStartTime(startTime)
    if (!parsed) return { ok: false, error: "Enter a start time." }
    const updated = await getDb()
      .update(gameNight)
      .set({ startTime: parsed })
      .where(eq(gameNight.date, date))
      .returning({ id: gameNight.id })
    if (updated.length === 0) {
      return { ok: false, error: "Open the night before setting a start time." }
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function setNightGame(date: string, game: string): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }
    const parsed = parseGame(game)
    if (!parsed) return { ok: false, error: "Keep the game name to 80 characters." }
    const updated = await getDb()
      .update(gameNight)
      .set({ game: parsed })
      .where(eq(gameNight.date, date))
      .returning({ id: gameNight.id })
    if (updated.length === 0) {
      return { ok: false, error: "Open the night before naming the game." }
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function setNightLocation(date: string, location: string): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }
    const parsed = parseLocation(location)
    if (!parsed) return { ok: false, error: "Keep the location to 80 characters." }
    const updated = await getDb()
      .update(gameNight)
      .set({ location: parsed })
      .where(eq(gameNight.date, date))
      .returning({ id: gameNight.id })
    if (updated.length === 0) {
      return { ok: false, error: "Open the night before setting a location." }
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function setNightWaitlist(date: string, enabled: boolean): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }
    const updated = await getDb()
      .update(gameNight)
      .set({ waitlistEnabled: enabled })
      .where(eq(gameNight.date, date))
      .returning({ id: gameNight.id })
    if (updated.length === 0) {
      return { ok: false, error: "Open the night before changing the waiting list." }
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function removeOwnBooking(bookingId: string): Promise<ActionResult> {
  try {
    if (!bookingId) return { ok: false, error: "Missing spot." }
    const viewer = await getViewer()
    const guestHash = await presentedGuestHash()
    const result = await getDb().transaction(async (tx) => {
      const [seat] = await tx
        .select({
          id: booking.id,
          userId: booking.userId,
          name: booking.name,
          guestTokenHash: booking.guestTokenHash,
          nightId: gameNight.id,
          nightDate: gameNight.date,
          capacity: gameNight.capacity,
        })
        .from(booking)
        .innerJoin(gameNight, eq(booking.gameNightId, gameNight.id))
        .where(eq(booking.id, bookingId))
        .limit(1)
      if (seat) {
        await tx.select().from(gameNight).where(eq(gameNight.id, seat.nightId)).for("update")
        const allowed = canRemoveOwnBooking({
          bookingUserId: seat.userId,
          viewerId: viewer?.id ?? null,
          storedTokenHash: seat.guestTokenHash,
          presentedTokenHash: guestHash,
        })
        if (!allowed) return { ok: false as const, error: "You can't remove that." }
        await tx.delete(booking).where(eq(booking.id, bookingId))
        await recordBookingEvent(tx, {
          action: "removed",
          nightDate: seat.nightDate,
          personName: seat.name,
          personKind: seat.userId ? "signed-in" : "guest",
          personUserId: seat.userId,
          actorName: null,
          actorUserId: null,
        })
        await promoteOpenSeats(tx, { id: seat.nightId, date: seat.nightDate, capacity: seat.capacity })
        return { ok: true as const }
      }
      const [queued] = await tx
        .select({
          id: waitlist.id,
          userId: waitlist.userId,
          name: waitlist.name,
          guestTokenHash: waitlist.guestTokenHash,
          nightId: gameNight.id,
          nightDate: gameNight.date,
        })
        .from(waitlist)
        .innerJoin(gameNight, eq(waitlist.gameNightId, gameNight.id))
        .where(eq(waitlist.id, bookingId))
        .limit(1)
      if (!queued) return { ok: false as const, error: "That spot is already gone." }
      await tx.select().from(gameNight).where(eq(gameNight.id, queued.nightId)).for("update")
      const allowed = canRemoveOwnBooking({
        bookingUserId: queued.userId,
        viewerId: viewer?.id ?? null,
        storedTokenHash: queued.guestTokenHash,
        presentedTokenHash: guestHash,
      })
      if (!allowed) return { ok: false as const, error: "You can't remove that." }
      await tx.delete(waitlist).where(eq(waitlist.id, bookingId))
      await recordBookingEvent(tx, {
        action: "wait_left",
        nightDate: queued.nightDate,
        personName: queued.name,
        personKind: queued.userId ? "signed-in" : "guest",
        personUserId: queued.userId,
        actorName: null,
        actorUserId: null,
      })
      return { ok: true as const }
    })
    if (result.ok) refresh()
    return result
  } catch (error) {
    return failure(error)
  }
}

export async function removeBooking(bookingId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdminViewer()
    if (!admin) return { ok: false, error: "You can't do that." }
    if (!bookingId) return { ok: false, error: "Missing booking." }
    const actorName = displayName(admin.name) ?? admin.email
    const result = await getDb().transaction(async (tx) => {
      const [seat] = await tx
        .select({
          id: booking.id,
          userId: booking.userId,
          name: booking.name,
          nightId: gameNight.id,
          nightDate: gameNight.date,
          capacity: gameNight.capacity,
        })
        .from(booking)
        .innerJoin(gameNight, eq(booking.gameNightId, gameNight.id))
        .where(eq(booking.id, bookingId))
        .limit(1)
      if (seat) {
        await tx.select().from(gameNight).where(eq(gameNight.id, seat.nightId)).for("update")
        await tx.delete(booking).where(eq(booking.id, bookingId))
        await recordBookingEvent(tx, {
          action: "removed",
          nightDate: seat.nightDate,
          personName: seat.name,
          personKind: seat.userId ? "signed-in" : "guest",
          personUserId: seat.userId,
          actorName,
          actorUserId: admin.id,
        })
        await promoteOpenSeats(tx, { id: seat.nightId, date: seat.nightDate, capacity: seat.capacity })
        return { ok: true as const }
      }
      const [queued] = await tx
        .select({
          id: waitlist.id,
          userId: waitlist.userId,
          name: waitlist.name,
          nightId: gameNight.id,
          nightDate: gameNight.date,
        })
        .from(waitlist)
        .innerJoin(gameNight, eq(waitlist.gameNightId, gameNight.id))
        .where(eq(waitlist.id, bookingId))
        .limit(1)
      if (!queued) return { ok: false as const, error: "That spot is already gone." }
      await tx.select().from(gameNight).where(eq(gameNight.id, queued.nightId)).for("update")
      await tx.delete(waitlist).where(eq(waitlist.id, bookingId))
      await recordBookingEvent(tx, {
        action: "wait_left",
        nightDate: queued.nightDate,
        personName: queued.name,
        personKind: queued.userId ? "signed-in" : "guest",
        personUserId: queued.userId,
        actorName,
        actorUserId: admin.id,
      })
      return { ok: true as const }
    })
    if (result.ok) refresh()
    return result
  } catch (error) {
    return failure(error)
  }
}

export async function setUserVerified(userId: string, verified: boolean): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!userId) return { ok: false, error: "Missing user." }
    const updated = await getDb()
      .update(user)
      .set({ verified })
      .where(eq(user.id, userId))
      .returning({ id: user.id })
    if (updated.length === 0) return { ok: false, error: "That person isn't registered." }
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}
