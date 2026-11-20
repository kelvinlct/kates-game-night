import { after } from "next/server"
import { waitUntil } from "@vercel/functions"
import type { AppDatabase } from "@/db"
import { bookingEvent } from "@/db/schema"
import { sendBookingNotice } from "@/lib/booking-mail"
import type { BookingEventDraft, BookingNotice } from "@/lib/history"

type EventStore = Pick<AppDatabase, "insert">

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/**
 * One place that records a join or removal and then asks for the admin email.
 * Mail is queued with after() and waitUntil so a slow SMTP call cannot fail
 * or delay the booking. Missing Gmail settings are skipped inside the sender.
 */
export function queueBookingEmail(notice: BookingNotice) {
  let pending: Promise<void> | null = null
  const run = () => {
    pending ??= sendBookingNotice(notice).then(
      () => undefined,
      (error: unknown) => {
        console.error("booking email failed", errorText(error, "email failed"))
      },
    )
    return pending
  }

  let scheduled = false
  try {
    waitUntil(run())
    scheduled = true
  } catch (error) {
    console.error("waitUntil failed", errorText(error, "waitUntil failed"))
  }
  try {
    after(() => run())
    scheduled = true
  } catch (error) {
    console.error("after failed", errorText(error, "after failed"))
  }
  if (!scheduled) void run()
}

export async function recordBookingEvent(db: EventStore, draft: BookingEventDraft): Promise<void> {
  const createdAt = new Date()
  await db.insert(bookingEvent).values({
    id: crypto.randomUUID(),
    action: draft.action,
    nightDate: draft.nightDate,
    personName: draft.personName,
    personKind: draft.personKind,
    personUserId: draft.personUserId,
    actorName: draft.actorName,
    actorUserId: draft.actorUserId,
    createdAt,
  })
  try {
    queueBookingEmail({ ...draft, createdAt })
  } catch (error) {
    console.error("booking email failed", errorText(error, "email failed"))
  }
}
