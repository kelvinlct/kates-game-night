import { describe, expect, it } from "vitest"
import {
  actionLabel,
  bookingEmailContent,
  formatShortNight,
  formatTorontoTimestamp,
  historyPageUrl,
  whoLabel,
  type BookingNotice,
} from "./history"

const joined: BookingNotice = {
  action: "joined",
  nightDate: "2026-11-20",
  personName: "Alex",
  personKind: "signed-in",
  personUserId: "user-1",
  actorName: null,
  actorUserId: null,
  createdAt: new Date("2026-11-21T00:30:00.000Z"),
}

describe("booking history labels", () => {
  it("names the person and whether they are signed in", () => {
    expect(whoLabel("Alex", "signed-in")).toBe("Alex · signed in")
    expect(whoLabel("Sam", "guest")).toBe("Sam · guest")
  })

  it("shows who removed someone when an admin did it", () => {
    expect(actionLabel(joined)).toBe("Joined")
    expect(actionLabel({ action: "joined", actorName: "Kate" })).toBe("Joined, added by Kate")
    expect(actionLabel({ action: "removed", actorName: null })).toBe("Removed")
    expect(actionLabel({ action: "removed", actorName: "Kate" })).toBe("Removed by Kate")
    expect(actionLabel({ action: "wait_joined", actorName: null })).toBe("Joined waiting list")
    expect(actionLabel({ action: "wait_joined", actorName: "Kate" })).toBe(
      "Joined waiting list, added by Kate",
    )
    expect(actionLabel({ action: "wait_left", actorName: null })).toBe("Left waiting list")
    expect(actionLabel({ action: "wait_promoted", actorName: null })).toBe("Promoted from waiting list")
  })

  it("formats the night and the Toronto timestamp", () => {
    expect(formatShortNight("2026-11-20")).toBe("Fri, Nov 20")
    expect(formatTorontoTimestamp(joined.createdAt)).toBe("Fri, Nov 20, 2026, 7:30 PM EST")
  })
})

describe("booking email", () => {
  it("builds a join notice with a history link", () => {
    const message = bookingEmailContent(joined, "https://games.example/admin/history")
    expect(message.subject).toBe("[Kate's Game Night] Alex joined Fri, Nov 20")
    expect(message.text).toBe(
      [
        "Alex (signed in) joined Friday, November 20.",
        "When: Fri, Nov 20, 2026, 7:30 PM EST",
        "History: https://games.example/admin/history",
      ].join("\n"),
    )
  })

  it("names the admin on a removal", () => {
    const message = bookingEmailContent(
      {
        ...joined,
        action: "removed",
        personKind: "guest",
        personUserId: null,
        actorName: "Kate",
        actorUserId: "admin-1",
      },
      "https://games.example/admin/history",
    )
    expect(message.subject).toBe("[Kate's Game Night] Alex was removed from Fri, Nov 20")
    expect(message.text).toContain("Alex (guest) was removed from Friday, November 20 by Kate.")
  })

  it("notes when an admin added someone", () => {
    const message = bookingEmailContent(
      { ...joined, actorName: "Kate", actorUserId: "admin-1" },
      "https://games.example/admin/history",
    )
    expect(message.subject).toBe("[Kate's Game Night] Alex joined Fri, Nov 20")
    expect(message.text).toContain("Alex (signed in) joined Friday, November 20, added by Kate.")
  })

  it("emails a waiting-list promotion", () => {
    const message = bookingEmailContent(
      { ...joined, action: "wait_promoted" },
      "https://games.example/admin/history",
    )
    expect(message.subject).toBe(
      "[Kate's Game Night] Alex was promoted from the waiting list for Fri, Nov 20",
    )
    expect(message.text).toContain(
      "Alex (signed in) was promoted from the waiting list into Friday, November 20.",
    )
  })

  it("prefers the configured site URL for the history link", () => {
    expect(historyPageUrl({ BETTER_AUTH_URL: "https://games.example/" } as unknown as NodeJS.ProcessEnv)).toBe(
      "https://games.example/admin/history",
    )
    expect(historyPageUrl({ VERCEL_URL: "preview.vercel.app" } as unknown as NodeJS.ProcessEnv)).toBe(
      "https://preview.vercel.app/admin/history",
    )
    expect(historyPageUrl({} as unknown as NodeJS.ProcessEnv)).toBe("http://localhost:3000/admin/history")
  })
})
