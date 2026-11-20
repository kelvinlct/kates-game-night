import { describe, expect, it } from "vitest"
import { displayName, shownBookingName } from "./names"

describe("display name", () => {
  it("trims and accepts 1 to 40 characters", () => {
    expect(displayName("  Sam Chen  ")).toBe("Sam Chen")
    expect(displayName("A")).toBe("A")
    expect(displayName("a".repeat(40))).toBe("a".repeat(40))
  })

  it("rejects empty and over-long names", () => {
    expect(displayName("   ")).toBeNull()
    expect(displayName("")).toBeNull()
    expect(displayName("a".repeat(41))).toBeNull()
  })

  it("shows a signed-in user's current name on their bookings", () => {
    expect(shownBookingName("Old Name", "New Name")).toBe("New Name")
    expect(shownBookingName("Robin", null)).toBe("Robin")
    expect(shownBookingName("Robin", "  ")).toBe("Robin")
  })
})