import { describe, expect, it, vi } from "vitest"
import { gmailAuth, gmailTransportOptions, sendBookingNotice, type Mailer } from "./booking-mail"
import type { BookingNotice } from "./history"

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

const env = {
  GMAIL_USER: "kate@gmail.com",
  GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  ADMIN_EMAILS: "Kate@Example.com, sam@example.com",
  BETTER_AUTH_URL: "https://games.example",
} as unknown as NodeJS.ProcessEnv

describe("gmail booking mail", () => {
  it("uses Gmail SMTP on port 465 and ignores spaces in the app password", () => {
    expect(gmailAuth(env)).toEqual({ user: "kate@gmail.com", pass: "abcdefghijklmnop" })
    expect(gmailTransportOptions({ user: "kate@gmail.com", pass: "secret" })).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "kate@gmail.com", pass: "secret" },
    })
  })

  it("skips when Gmail is not configured", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const transport: Mailer = { sendMail: vi.fn() }
    const result = await sendBookingNotice(notice, {
      env: { ADMIN_EMAILS: "kate@example.com" } as unknown as NodeJS.ProcessEnv,
      transport,
    })
    expect(result).toEqual({ sent: false })
    expect(transport.sendMail).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalled()
    info.mockRestore()
  })

  it("sends one plain-text note to every admin", async () => {
    const transport: Mailer = { sendMail: vi.fn(async () => ({ messageId: "1" })) }
    const result = await sendBookingNotice(notice, { env, transport })
    expect(result).toEqual({ sent: true })
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: "kate@gmail.com",
      to: "kate@example.com, sam@example.com",
      subject: "[Kate's Game Night] Alex joined Fri, Nov 20",
      text: [
        "Alex (signed in) joined Friday, November 20.",
        "When: Fri, Nov 20, 2026, 7:30 PM EST",
        "History: https://games.example/admin/history",
      ].join("\n"),
    })
  })
})
