import { createHash, timingSafeEqual } from "node:crypto"

export const WRONG_ANSWER_LIMIT = 5
export const WRONG_ANSWER_WINDOW_MS = 60 * 60 * 1000

/**
 * The expected answer lives only in SECURITY_ANSWER.
 * Callers must never send that value to the browser.
 */
export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase()
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

/**
 * Trimmed, case-insensitive compare. Both sides are hashed so the
 * comparison stays constant-time even when the lengths differ.
 */
export function answersMatch(
  provided: string,
  expected: string | null | undefined,
): boolean {
  const providedDigest = digest(normalizeAnswer(provided))
  const expectedDigest = digest(normalizeAnswer(expected ?? ""))
  const same = timingSafeEqual(providedDigest, expectedDigest)
  const configured = Boolean(expected && expected.trim())
  return configured && same
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
