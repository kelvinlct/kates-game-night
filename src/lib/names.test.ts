import { describe, expect, it } from "vitest"
import { accountDisplayName, displayName, guestBookingRename, shownBookingName } from "./names"

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

  it("uses the same 1 to 40 character rule for an admin rename", () => {
    expect(accountDisplayName("  Alex  ")).toEqual({ ok: true, name: "Alex" })
    expect(accountDisplayName("  ")).toEqual({ ok: false, error: "Use 1 to 40 characters." })
    expect(accountDisplayName("a".repeat(41)).ok).toBe(false)
  })

  it("lets an admin rename a guest booking, not an account booking", () => {
    expect(guestBookingRename(null, "Robin")).toEqual({ ok: true, name: "Robin" })
    expect(guestBookingRename("user-1", "Robin")).toEqual({
      ok: false,
      error: "Change account names on the Users page.",
    })
  })

  it("shows a signed-in user's current name on their bookings", () => {
    expect(shownBookingName("Old Name", "New Name")).toBe("New Name")
    expect(shownBookingName("Robin", null)).toBe("Robin")
    expect(shownBookingName("Robin", "  ")).toBe("Robin")
  })
})