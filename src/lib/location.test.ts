import { describe, expect, it } from "vitest"
import { DEFAULT_LOCATION, displayLocation, locationLabel, parseLocation } from "./location"

describe("night location", () => {
  it("defaults a blank or missing location to Kate's place", () => {
    expect(parseLocation("")).toBe(DEFAULT_LOCATION)
    expect(parseLocation("   ")).toBe("Kate's place")
    expect(locationLabel(null)).toBe("Kate's place")
    expect(locationLabel(undefined)).toBe("Kate's place")
    expect(displayLocation("Kate's place")).toBe("Location: Kate's place")
    expect(displayLocation("The library")).toBe("Location: The library")
  })

  it("keeps a trimmed place and rejects anything over 80 characters", () => {
    expect(parseLocation("  The library  ")).toBe("The library")
    expect(parseLocation("a".repeat(80))).toBe("a".repeat(80))
    expect(parseLocation("a".repeat(81))).toBeNull()
  })
})