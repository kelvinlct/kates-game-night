export const HOST_NAME = "Kate"
export const DISPLAY_NAME_MAX = 40

export function cleanName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ")
  if (name.length < 1 || name.length > 60) return null
  if (!/\p{L}/u.test(name)) return null
  return name
}

export const DISPLAY_NAME_ERROR = "Use 1 to 40 characters."

/** Account display name: trimmed, collapsed spaces, 1–40 characters. */
export function displayName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ")
  if (name.length < 1 || name.length > DISPLAY_NAME_MAX) return null
  return name
}

export function accountDisplayName(
  input: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = displayName(input)
  if (!name) return { ok: false, error: DISPLAY_NAME_ERROR }
  return { ok: true, name }
}

/** A guest booking has no account. Account names are edited on the Users page. */
export function guestBookingRename(
  userId: string | null,
  input: string,
): { ok: true; name: string } | { ok: false; error: string } {
  if (userId) return { ok: false, error: "Change account names on the Users page." }
  return accountDisplayName(input)
}

/** Signed-in bookings show the user's current name. Guests keep the name they typed. */
export function shownBookingName(snapshot: string, currentUserName: string | null | undefined): string {
  const current = currentUserName?.trim()
  return current ? current : snapshot
}

export function firstName(name: string): string {
  const cleaned = name.trim()
  const [first] = cleaned.split(/\s+/)
  return first || cleaned
}
