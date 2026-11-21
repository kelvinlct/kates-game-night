export const DEFAULT_LOCATION = "Kate's place"
export const LOCATION_MAX = 80

/** Blank input stays the default. Anything longer than 80 characters is rejected. */
export function parseLocation(value: unknown): string | null {
  const location = String(value ?? "").trim().replace(/\s+/g, " ")
  if (location.length === 0) return DEFAULT_LOCATION
  if (location.length > LOCATION_MAX) return null
  return location
}

export function locationLabel(stored: string | null | undefined): string {
  return parseLocation(stored) ?? DEFAULT_LOCATION
}

/** Shown in the day dialog. Admin inputs keep the bare text. */
export function displayLocation(location: string): string {
  return `Location: ${location}`
}
