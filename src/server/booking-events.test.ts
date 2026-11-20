import { after } from "next/server"
import { waitUntil } from "@vercel/functions"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sendBookingNotice } from "@/lib/booking-mail"
import { queueBookingEmail } from "./booking-events"
import type { BookingNotice } from "@/lib/history"

vi.mock("next/server", () => ({
  after: vi.fn((task: () => unknown) => task),
}))

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn(),
}))

vi.mock("@/lib/booking-mail", () => ({
  sendBookingNotice: vi.fn(),
}))

const notice: BookingNotice = {
  action: "joined",
  nightDate: "2026-11-20",
  personName: "Alex",
  personKind: "signed-in",
  personUserId: "user-1",
  actorName: null,
  actorUserId: null,
  createdAt: new Date("2026-11-21T00:30:00.000Z"),
}

describe("queueBookingEmail", () => {
  afterEach(() => {
    vi.mocked(sendBookingNotice).mockReset()
    vi.mocked(waitUntil).mockReset()
    vi.mocked(after).mockClear()
  })

  it("sends once, held by after and waitUntil", async () => {
    vi.mocked(sendBookingNotice).mockResolvedValue({ sent: true })
    queueBookingEmail(notice)
    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)
    await vi.mocked(waitUntil).mock.calls[0][0]
    const task = vi.mocked(after).mock.calls[0][0]
    if (typeof task === "function") await task()
    expect(sendBookingNotice).toHaveBeenCalledTimes(1)
  })

  it("swallows a transport error", async () => {
    vi.mocked(sendBookingNotice).mockRejectedValue(new Error("smtp down"))
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    queueBookingEmail(notice)
    await vi.mocked(waitUntil).mock.calls[0][0]
    expect(error).toHaveBeenCalledWith("booking email failed", "smtp down")
    error.mockRestore()
  })
})
