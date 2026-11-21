import { createHash, timingSafeEqual } from "node:crypto"

export const WRONG_ANSWER_LIMIT = 5

/**
 * Wait after each new batch of 5 wrong answers. The fourth batch and
 * every batch after it stay at 1 hour: 5 minutes, 15 minutes, 30 minutes, 1 hour.
 */
export const LOCKOUT_STEPS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
] as const

/** No wrong answers for this long starts the ladder over. A correct answer also resets it. */
export const QUIET_RESET_MS = 24 * 60 * 60 * 1000

/** Stored failures older than this are deleted. The ladder resets sooner, after QUIET_RESET_MS. */
export const FAILURE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export type AnswerLockout = {
  locked: boolean
  retryAt: number | null
  waitMs: number
}

export function lockoutDurationMs(lockoutIndex: number): number {
  const last = LOCKOUT_STEPS_MS.length - 1
  const index = Math.min(Math.max(lockoutIndex, 0), last)
  return LOCKOUT_STEPS_MS[index]
}

/**
 * Failures are epoch milliseconds. A batch of 5 starts a lockout at the fifth
 * failure. Tries recorded during a lockout do not count toward the next batch.
 * A 24 hour gap, or a last failure 24 hours ago, drops the earlier ladder.
 */
export function lockoutFromFailures(failureTimes: number[], now: number): AnswerLockout {
  const sorted = failureTimes.filter((time) => Number.isFinite(time)).sort((left, right) => left - right)
  let streakStart = 0
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] - sorted[index - 1] >= QUIET_RESET_MS) streakStart = index
  }
  const streak = sorted.slice(streakStart)
  const latest = streak[streak.length - 1]
  if (latest === undefined || now - latest >= QUIET_RESET_MS) {
    return { locked: false, retryAt: null, waitMs: 0 }
  }

  let lockoutIndex = 0
  let batch = 0
  let activeEnd: number | null = null

  for (const time of streak) {
    if (activeEnd !== null && time < activeEnd) continue
    if (activeEnd !== null && time >= activeEnd) activeEnd = null
    batch += 1
    if (batch >= WRONG_ANSWER_LIMIT) {
      activeEnd = time + lockoutDurationMs(lockoutIndex)
      lockoutIndex += 1
      batch = 0
    }
  }

  if (activeEnd !== null && now < activeEnd) {
    return { locked: true, retryAt: activeEnd, waitMs: activeEnd - now }
  }
  return { locked: false, retryAt: null, waitMs: 0 }
}

function unit(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatWait(waitMs: number): string {
  const totalSeconds = Math.max(1, Math.ceil(waitMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(unit(hours, "hour", "hours"))
  if (minutes > 0) parts.push(unit(minutes, "minute", "minutes"))
  if (seconds > 0 && hours === 0) parts.push(unit(seconds, "second", "seconds"))
  return parts.join(" ")
}

export function lockoutMessage(waitMs: number): string {
  return `Too many tries. Try again in ${formatWait(waitMs)}.`
}

/**
 * The expected answers live only in SECURITY_ANSWER.
 * Callers must never send that value to the browser.
 *
 * NFKC first so fullwidth letters and a fullwidth comma fold to ASCII,
 * then trim and case-fold. Commas separate accepted answers (`Smith,李`).
 */
export function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase()
}

export function acceptedAnswers(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .normalize("NFKC")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

/**
 * True when the provided answer matches any accepted candidate.
 * Each candidate is hashed and compared with timingSafeEqual, and every
 * candidate is compared even after a match.
 */
export function answersMatch(
  provided: string,
  expected: string | null | undefined,
): boolean {
  const candidates = acceptedAnswers(expected)
  const providedDigest = digest(normalizeAnswer(provided))
  if (candidates.length === 0) {
    timingSafeEqual(providedDigest, digest(""))
    return false
  }
  let matched = false
  for (const candidate of candidates) {
    const same = timingSafeEqual(providedDigest, digest(candidate))
    matched = matched || same
  }
  return matched
}

export function checkSecurityAnswer(
  provided: string,
  expected: string | null | undefined = process.env.SECURITY_ANSWER,
): boolean {
  return answersMatch(provided, expected)
}

export function isRateLimited(
  recentFailures: number,
  limit = WRONG_ANSWER_LIMIT,
): boolean {
  return recentFailures >= limit
}
