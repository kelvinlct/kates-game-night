export const DEFAULT_GAME = "Undecided"
export const GAME_MAX = 80

/** Blank input stays the default. Anything longer than 80 characters is rejected. */
export function parseGame(value: unknown): string | null {
  const game = String(value ?? "").trim().replace(/\s+/g, " ")
  if (game.length === 0) return DEFAULT_GAME
  if (game.length > GAME_MAX) return null
  return game
}

export function gameLabel(stored: string | null | undefined): string {
  return parseGame(stored) ?? DEFAULT_GAME
}
