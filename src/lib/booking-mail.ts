import nodemailer from "nodemailer"
import { adminEmailList } from "@/lib/admin"
import { bookingEmailContent, historyPageUrl, type BookingNotice } from "@/lib/history"

export type OutboundMail = {
  from: string
  to: string
  subject: string
  text: string
}

export type Mailer = {
  sendMail(message: OutboundMail): Promise<unknown>
}

export function gmailAuth(env: NodeJS.ProcessEnv): { user: string; pass: string } | null {
  const user = env.GMAIL_USER?.trim() ?? ""
  const pass = env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") ?? ""
  if (!user || !pass) return null
  return { user, pass }
}

export function gmailTransportOptions(auth: { user: string; pass: string }) {
  return {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth,
  } as const
}

export function createGmailTransport(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  const auth = gmailAuth(env)
  if (!auth) return null
  return nodemailer.createTransport(gmailTransportOptions(auth))
}

/**
 * Sends one notice to every admin. Missing Gmail settings skip the send.
 * Callers must catch a thrown transport error.
 */
export async function sendBookingNotice(
  notice: BookingNotice,
  options?: { env?: NodeJS.ProcessEnv; transport?: Mailer | null },
): Promise<{ sent: boolean }> {
  const env = options?.env ?? process.env
  const auth = gmailAuth(env)
  if (!auth) {
    console.info("booking email skipped: GMAIL_USER or GMAIL_APP_PASSWORD is unset")
    return { sent: false }
  }
  const recipients = adminEmailList(env.ADMIN_EMAILS)
  if (recipients.length === 0) {
    console.info("booking email skipped: ADMIN_EMAILS is empty")
    return { sent: false }
  }
  const transport = options?.transport ?? createGmailTransport(env)
  if (!transport) {
    console.info("booking email skipped: GMAIL_USER or GMAIL_APP_PASSWORD is unset")
    return { sent: false }
  }
  const message = bookingEmailContent(notice, historyPageUrl(env))
  await transport.sendMail({
    from: auth.user,
    to: recipients.join(", "),
    subject: message.subject,
    text: message.text,
  })
  return { sent: true }
}
