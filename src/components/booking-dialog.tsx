"use client"

import { useActionState, useState, useTransition } from "react"
import { spotsLeft } from "@/lib/capacity"
import { formatNightHeading } from "@/lib/start-time"
import { HOST_NAME, firstName } from "@/lib/names"
import type { ActionResult, BookMode, DayView } from "@/lib/types"
import { bookSpot, removeBooking, setNightCapacity, setNightOpen, setNightStartTime } from "@/server/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

function statusLine(day: DayView): string {
  if (day.status === "closed") return "Closed. No game this night."
  if (day.isPast) return "This night has passed."
  if (day.viewerBooked) return "You're on the list."
  if (day.status === "full") return "Game confirmed."
  const left = Math.max(0, spotsLeft(day.capacity, day.guestCount))
  return left === 1 ? "1 spot left." : `${left} spots left.`
}

export function BookingDialog({
  day,
  open,
  onOpenChange,
  bookMode,
  viewerName,
  isAdmin,
}: {
  day: DayView
  open: boolean
  onOpenChange: (open: boolean) => void
  bookMode: BookMode
  viewerName: string | null
  isAdmin: boolean
}) {
  const canBook = day.inMonth && day.status === "open" && !day.isPast && !day.viewerBooked
  const [state, action, pending] = useActionState(bookSpot, null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const [startTime, setStartTime] = useState(day.startTime)
  const [trackedStart, setTrackedStart] = useState(day.startTime)
  if (trackedStart !== day.startTime) {
    setTrackedStart(day.startTime)
    setStartTime(day.startTime)
  }

  const prefilled = viewerName ? firstName(viewerName) : ""

  function run(task: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await task()
      setNotice(result.ok ? null : result.error)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {formatNightHeading(day.date, day.timeLabel)}
          </DialogTitle>
          <DialogDescription>
            {day.label ? `${day.label}. ` : ""}
            {statusLine(day)}
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Who&apos;s coming
          </p>
          <ul className="flex flex-col gap-1.5">
            <li className="flex items-center justify-between text-sm">
              <span>{HOST_NAME}</span>
              <span className="text-xs text-muted-foreground">host</span>
            </li>
            {day.bookings.length === 0 ? (
              <li className="text-sm text-muted-foreground">Nobody else yet.</li>
            ) : (
              day.bookings.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {person.firstName}
                    {isAdmin && person.name && person.name !== person.firstName ? (
                      <span className="text-muted-foreground"> · {person.name}</span>
                    ) : null}
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="text-xs text-destructive underline-offset-2 hover:underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => run(() => removeBooking(person.id))}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>

        {state?.ok ? <p className="text-sm text-primary">You&apos;re booked.</p> : null}
        {canBook && !state?.ok ? (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="date" value={day.date} />
            {bookMode === "one-click" ? (
              <input type="hidden" name="name" value={viewerName ?? ""} />
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="guest-name">Your name</Label>
                <Input
                  id="guest-name"
                  name="name"
                  required
                  maxLength={60}
                  defaultValue={prefilled}
                  placeholder="First name"
                  autoComplete="given-name"
                />
              </div>
            )}
            {bookMode !== "one-click" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="security-answer">What is Kate&apos;s last name?</Label>
                <Input
                  id="security-answer"
                  name="answer"
                  required
                  autoComplete="off"
                  autoCapitalize="off"
                />
              </div>
            ) : null}
            {state && !state.ok ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending} className="h-10">
              {pending ? "Booking…" : bookMode === "one-click" ? "Book my spot" : "Book a spot"}
            </Button>
          </form>
        ) : null}

        {isAdmin ? (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="open-night">Open this night</Label>
              <Switch
                id="open-night"
                checked={day.status !== "closed"}
                disabled={busy}
                onCheckedChange={(checked) => run(() => setNightOpen(day.date, checked, startTime))}
              />
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                run(() => setNightStartTime(day.date, startTime))
              }}
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="start-time">Start time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  disabled={busy}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
              <Button type="submit" variant="outline" disabled={!day.stored || busy}>
                Save
              </Button>
            </form>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                run(() => setNightCapacity(day.date, Number(data.get("capacity"))))
              }}
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="capacity">Capacity, including Kate</Label>
                <Input
                  id="capacity"
                  key={`${day.date}-${day.capacity}`}
                  name="capacity"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={day.capacity}
                  disabled={!day.stored || busy}
                />
              </div>
              <Button type="submit" variant="outline" disabled={!day.stored || busy}>
                Save
              </Button>
            </form>
            {!day.stored ? (
              <p className="text-xs text-muted-foreground">Open the night before setting a capacity.</p>
            ) : null}
            {notice ? (
              <p role="alert" className="text-sm text-destructive">
                {notice}
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
