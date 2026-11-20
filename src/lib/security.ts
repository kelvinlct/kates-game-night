import { createHash, timingSafeEqual } from "node:crypto"

export const WRONG_ANSWER_LIMIT = 5
export const WRONG_ANSWER_WINDOW_MS = 60 * 60 * 1000

/**
 * The expected answers live only in SECURITY_ANSWER.
 * Callers must never send that value to the browser.
 *
 * NFKC first so fullwidth letters and a fullwidth comma fold to ASCII,
 * then trim and case-fold. Commas separate accepted answers (`Yuen,阮`).
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
