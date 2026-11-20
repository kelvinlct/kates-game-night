import { createHash, timingSafeEqual } from "node:crypto"
import type { BookMode } from "@/lib/types"

export const GUEST_COOKIE = "kates_guest"

/** Verified accounts, and admins, join in one click. Other signed-in people answer once. */
export function bookModeFor(viewer: { verified: boolean; isAdmin?: boolean } | null): BookMode {
  if (!viewer) return "guest"
  if (viewer.isAdmin || viewer.verified) return "one-click"
  return "answer"
}

/** A correct answer from a signed-in, not-yet-verified person sets the admin verified flag. */
export function shouldMarkVerified(input: {
  signedIn: boolean
  alreadyVerified: boolean
  answerCorrect: boolean
}): boolean {
  return input.signedIn && !input.alreadyVerified && input.answerCorrect
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function hashesMatch(stored: string, presented: string): boolean {
  const left = Buffer.from(stored)
  const right = Buffer.from(presented)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * The signed-in owner can drop their row. A guest can drop a row that has no
 * user id only when the browser cookie hashes to the value stored on it.
 */
export function canRemoveOwnBooking(input: {
  bookingUserId: string | null
  viewerId: string | null
  storedTokenHash: string | null
  presentedTokenHash: string | null
}): boolean {
  if (input.viewerId && input.bookingUserId && input.viewerId === input.bookingUserId) {
    return true
  }
  if (input.bookingUserId) return false
  if (!input.storedTokenHash || !input.presentedTokenHash) return false
  return hashesMatch(input.storedTokenHash, input.presentedTokenHash)
}
