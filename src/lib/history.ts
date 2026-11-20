import { formatLongDate, TIME_ZONE } from "@/lib/dates"

export const HISTORY_LIMIT = 200

export type BookingAction = "joined" | "removed"
export type PersonKind = "signed-in" | "guest"

export type BookingEventDraft = {
  action: BookingAction
  nightDate: string
  personName: string
  personKind: PersonKind
  personUserId: string | null
  /** Admin who removed someone else. Null when the person joined or removed themselves. */
  actorName: string | null
  actorUserId: string | null
}

export type BookingNotice = BookingEventDraft & {
  createdAt: Date
}

export function kindLabel(kind: PersonKind): string {
  return kind === "guest" ? "guest" : "signed in"
}

export function whoLabel(name: string, kind: PersonKind): string {
  return `${name} · ${kindLabel(kind)}`
}

export function actionLabel(event: Pick<BookingEventDraft, "action" | "actorName">): string {
  if (event.action === "joined") return "Joined"
  if (event.actorName) return `Removed by ${event.actorName}`
  return "Removed"
}

/** "Fri, Nov 20" for a plain calendar date. */
export function formatShortNight(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function formatTorontoTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date)
}

export function historyPageUrl(env: NodeJS.ProcessEnv): string {
  const configured = env.BETTER_AUTH_URL?.trim().replace(/\/$/, "")
  if (configured) return `${configured}/admin/history`
  const production = env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/^https?:\/\//, "")
  if (production) return `https://${production}/admin/history`
  const preview = env.VERCEL_URL?.trim().replace(/^https?:\/\//, "")
  if (preview) return `https://${preview}/admin/history`
  return "http://localhost:3000/admin/history"
}

export function bookingEmailContent(
  notice: BookingNotice,
  historyUrl: string,
): { subject: string; text: string } {
  const night = formatShortNight(notice.nightDate)
  const joined = notice.action === "joined"
  const subject = `[Kate's Game Night] ${notice.personName} ${joined ? "joined" : "was removed from"} ${night}`
  const who = `${notice.personName} (${kindLabel(notice.personKind)})`
  const longNight = formatLongDate(notice.nightDate)
  const sentence = joined
    ? `${who} joined ${longNight}.`
    : notice.actorName
      ? `${who} was removed from ${longNight} by ${notice.actorName}.`
      : `${who} was removed from ${longNight}.`
  const text = [sentence, `When: ${formatTorontoTimestamp(notice.createdAt)}`, `History: ${historyUrl}`].join("\n")
  return { subject, text }
}
