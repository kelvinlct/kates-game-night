"use server"

import { randomBytes } from "node:crypto"
import { and, eq, gt, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { getDb } from "@/db"
import { answerAttempt, booking, gameNight, user } from "@/db/schema"
import { DEFAULT_CAPACITY, isFull, parseCapacity } from "@/lib/capacity"
import { isPastDate, isRealDate, todayInToronto } from "@/lib/dates"
import {
  GUEST_COOKIE,
  canRemoveOwnBooking,
  hashGuestToken,
  shouldMarkVerified,
} from "@/lib/join"
import { cleanName, displayName } from "@/lib/names"
import { getAuth } from "@/lib/auth"
import { defaultStartTime, parseStartTime } from "@/lib/start-time"
import {
  WRONG_ANSWER_WINDOW_MS,
  checkSecurityAnswer,
  isRateLimited,
} from "@/lib/security"
import type { ActionResult } from "@/lib/types"
import { clientIp, getViewer } from "@/server/session"

function refresh() {
  revalidatePath("/")
  revalidatePath("/admin")
}

function failure(error: unknown): ActionResult {
  console.error(error instanceof Error ? error.message : "request failed")
  return { ok: false, error: "Something went wrong. Try again." }
}

async function recentFailures(ip: string): Promise<number> {
  const since = new Date(Date.now() - WRONG_ANSWER_WINDOW_MS)
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(answerAttempt)
    .where(and(eq(answerAttempt.ip, ip), gt(answerAttempt.createdAt, since)))
  return Number(row?.value ?? 0)
}

async function recordFailure(ip: string) {
  const db = getDb()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await db.insert(answerAttempt).values({ id: crypto.randomUUID(), ip })
  await db.delete(answerAttempt).where(sql`${answerAttempt.createdAt} < ${dayAgo}`)
}

export async function bookSpot(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const date = String(formData.get("date") ?? "")
    if (!isRealDate(date)) return { ok: false, error: "Pick a real date." }

    const viewer = await getViewer()
    const needsAnswer = !viewer || !viewer.verified
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
      if (isRateLimited(await recentFailures(ip))) {
        return { ok: false, error: "Too many tries. Wait an hour and try again." }
      }
      answerCorrect = checkSecurityAnswer(answer)
      if (!answerCorrect) {
        await recordFailure(ip)
        return { ok: false, error: "That's not the right answer." }
      }
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
        .select({ id: booking.id, userId: booking.userId })
        .from(booking)
        .where(eq(booking.gameNightId, night.id))

      if (viewer && existing.some((item) => item.userId === viewer.id)) {
        return { ok: false as const, error: "You're already in." }
      }
      if (isFull(night.capacity, existing.length)) {
        return { ok: false as const, error: "That night is full." }
      }

      if (markVerified && viewer) {
        await tx.update(user).set({ verified: true }).where(eq(user.id, viewer.id))
      }

      await tx.insert(booking).values({
        id: crypto.randomUUID(),
        gameNightId: night.id,
        userId: viewer?.id ?? null,
        guestTokenHash: guest?.hash ?? null,
        name,
      })
      return { ok: true as const }
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
    const cleaned = displayName(name)
    if (!cleaned) return { ok: false, error: "Use 1 to 40 characters." }
    await getAuth().api.updateUser({
      body: { name: cleaned },
      headers: await headers(),
    })
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
      await db
        .insert(gameNight)
        .values({
          id: crypto.randomUUID(),
          date,
          isOpen: true,
          capacity: DEFAULT_CAPACITY,
          startTime: requested ?? defaultStartTime(date),
        })
        .onConflictDoUpdate({
          target: gameNight.date,
          set: requested ? { isOpen: true, startTime: requested } : { isOpen: true },
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
    const updated = await getDb()
      .update(gameNight)
      .set({ capacity: parsed })
      .where(eq(gameNight.date, date))
      .returning({ id: gameNight.id })
    if (updated.length === 0) {
      return { ok: false, error: "Open the night before setting a capacity." }
    }
    refresh()
    return { ok: true }
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

export async function removeOwnBooking(bookingId: string): Promise<ActionResult> {
  try {
    if (!bookingId) return { ok: false, error: "Missing spot." }
    const viewer = await getViewer()
    const [row] = await getDb()
      .select({
        id: booking.id,
        userId: booking.userId,
        guestTokenHash: booking.guestTokenHash,
      })
      .from(booking)
      .where(eq(booking.id, bookingId))
      .limit(1)
    if (!row) return { ok: false, error: "That spot is already gone." }
    const allowed = canRemoveOwnBooking({
      bookingUserId: row.userId,
      viewerId: viewer?.id ?? null,
      storedTokenHash: row.guestTokenHash,
      presentedTokenHash: await presentedGuestHash(),
    })
    if (!allowed) return { ok: false, error: "You can't remove that." }
    await getDb().delete(booking).where(eq(booking.id, bookingId))
    refresh()
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function removeBooking(bookingId: string): Promise<ActionResult> {
  try {
    if (!(await requireAdminViewer())) return { ok: false, error: "You can't do that." }
    if (!bookingId) return { ok: false, error: "Missing booking." }
    await getDb().delete(booking).where(eq(booking.id, bookingId))
    refresh()
    return { ok: true }
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
