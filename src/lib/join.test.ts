import { describe, expect, it } from "vitest"
import { bookModeFor, canRemoveOwnBooking, hashGuestToken, shouldMarkVerified } from "./join"

describe("verify on a correct answer", () => {
  it("marks a signed-in unverified person when the answer is right", () => {
    expect(
      shouldMarkVerified({ signedIn: true, alreadyVerified: false, answerCorrect: true }),
    ).toBe(true)
  })

  it("does not mark guests, wrong answers, or people who are already verified", () => {
    expect(
      shouldMarkVerified({ signedIn: false, alreadyVerified: false, answerCorrect: true }),
    ).toBe(false)
    expect(
      shouldMarkVerified({ signedIn: true, alreadyVerified: false, answerCorrect: false }),
    ).toBe(false)
    expect(
      shouldMarkVerified({ signedIn: true, alreadyVerified: true, answerCorrect: true }),
    ).toBe(false)
  })

  it("asks unverified accounts once, then lets verified accounts join in one click", () => {
    expect(bookModeFor(null)).toBe("guest")
    expect(bookModeFor({ verified: false })).toBe("answer")
    expect(bookModeFor({ verified: true })).toBe("one-click")
  })
})

describe("guest self-removal", () => {
  const token = "browser-token"
  const hash = hashGuestToken(token)

  it("lets the guest who holds the cookie remove that booking", () => {
    expect(
      canRemoveOwnBooking({
        bookingUserId: null,
        viewerId: null,
        storedTokenHash: hash,
        presentedTokenHash: hashGuestToken(token),
      }),
    ).toBe(true)
  })

  it("rejects a missing or different cookie, and a signed-in booking", () => {
    expect(
      canRemoveOwnBooking({
        bookingUserId: null,
        viewerId: null,
        storedTokenHash: hash,
        presentedTokenHash: hashGuestToken("someone-else"),
      }),
    ).toBe(false)
    expect(
      canRemoveOwnBooking({
        bookingUserId: null,
        viewerId: null,
        storedTokenHash: hash,
        presentedTokenHash: null,
      }),
    ).toBe(false)
    expect(
      canRemoveOwnBooking({
        bookingUserId: "user-1",
        viewerId: null,
        storedTokenHash: hash,
        presentedTokenHash: hash,
      }),
    ).toBe(false)
  })

  it("lets a signed-in person remove only their own booking", () => {
    expect(
      canRemoveOwnBooking({
        bookingUserId: "user-1",
        viewerId: "user-1",
        storedTokenHash: null,
        presentedTokenHash: null,
      }),
    ).toBe(true)
    expect(
      canRemoveOwnBooking({
        bookingUserId: "user-2",
        viewerId: "user-1",
        storedTokenHash: null,
        presentedTokenHash: null,
      }),
    ).toBe(false)
  })
})
