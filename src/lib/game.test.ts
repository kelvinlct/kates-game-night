import { describe, expect, it } from "vitest"
import { DEFAULT_GAME, displayGame, gameLabel, parseGame } from "./game"

describe("board game field", () => {
  it("defaults a blank or missing game to TBD", () => {
    expect(parseGame("")).toBe(DEFAULT_GAME)
    expect(parseGame("   ")).toBe(DEFAULT_GAME)
    expect(gameLabel(null)).toBe("TBD")
    expect(gameLabel(undefined)).toBe("TBD")
    expect(displayGame("TBD")).toBe("Game: TBD")
    expect(displayGame("Catan")).toBe("Game: Catan")
  })

  it("keeps a trimmed name and rejects anything over 80 characters", () => {
    expect(parseGame("  Catan  ")).toBe("Catan")
    expect(parseGame("a".repeat(80))).toBe("a".repeat(80))
    expect(parseGame("a".repeat(81))).toBeNull()
  })
})