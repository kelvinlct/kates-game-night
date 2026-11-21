"use client"

import { useActionState, useState, useTransition } from "react"
import { spotsLeft } from "@/lib/capacity"
import { displayGame } from "@/lib/game"
import { displayLocation } from "@/lib/location"
import { formatNightHeading } from "@/lib/start-time"
import { HOST_NAME, firstName } from "@/lib/names"
import type { ActionResult, BookMode, DayView } from "@/lib/types"
import { AdminAdd } from "@/components/admin-add"
import type { DirectoryUser } from "@/lib/admin-add"
import { bookSpot, removeBooking, removeOwnBooking, renameGuestBooking, setNightCapacity, setNightGame, setNightLocation, setNightOpen, setNightStartTime } from "@/server/actions"
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
  if (day.viewerBooked) return "You're in."
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
  directory = [],
}: {
  day: DayView
  open: boolean
  onOpenChange: (open: boolean) => void
  bookMode: BookMode
  viewerName: string | null
  isAdmin: boolean
  directory?: DirectoryUser[]
}) {
  const canBook = day.inMonth && day.status === "open" && !day.isPast && !day.viewerBooked
  const canAdminAdd = isAdmin && day.inMonth && !day.isPast && day.status !== "closed"
  const askAnswer = !isAdmin && bookMode !== "one-click"
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
          {day.status !== "closed" ? (
            <>
              <p className="text-sm text-foreground">{displayGame(day.game)}</p>
              <p className="text-sm text-foreground">{displayLocation(day.location)}</p>
            </>
          ) : null}
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
            {day.bookings.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {person.firstName}
                  {isAdmin && person.name && person.name !== person.firstName ? (
                    <span className="text-muted-foreground"> · {person.name}</span>
                  ) : null}
                </span>
                {isAdmin && person.userId === null ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const name = String(new FormData(event.currentTarget).get("name") ?? "")
                      run(() => renameGuestBooking(person.id, name))
                    }}
                  >
                    <Input
                      name="name"
                      required
                      maxLength={40}
                      key={`${person.id}-${person.name ?? person.firstName}`}
                      defaultValue={person.name ?? person.firstName}
                      disabled={busy}
                      aria-label={`Name for ${person.firstName}`}
                      className="h-7 w-28"
                    />
                    <Button type="submit" size="sm" variant="outline" disabled={busy}>
                      Save
                    </Button>
                  </form>
                ) : null}
                {person.canRemove ? (
                  <button
                    type="button"
                    className="text-xs text-destructive underline-offset-2 hover:underline disabled:opacity-50"
                    disabled={busy}
                    onClick={() => run(() => removeOwnBooking(person.id))}
                  >
                    Remove me
                  </button>
                ) : null}
                {isAdmin && !person.canRemove ? (
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
            ))}
          </ul>
        </div>

        {state?.ok ? <p className="text-sm text-primary">You&apos;re in!</p> : null}
        {canBook && !state?.ok ? (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="date" value={day.date} />
            {bookMode === "guest" ? (
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
            ) : null}
            {askAnswer ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="security-answer" className="gap-1.5">
                  <span>What is Kate&apos;s last name?</span>
                  <span className="text-xs font-normal text-muted-foreground">(security question)</span>
                </Label>
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
              {pending ? "Joining…" : "JOIN!"}
            </Button>
          </form>
        ) : null}

        {canAdminAdd ? (
          <AdminAdd
            date={day.date}
            users={directory}
            bookedUserIds={day.bookings.flatMap((person) => (person.userId ? [person.userId] : []))}
          />
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
                run(() => setNightGame(day.date, String(data.get("game") ?? "")))
              }}
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="board-game">Board game</Label>
                <Input
                  id="board-game"
                  name="game"
                  maxLength={80}
                  key={`${day.date}-${day.game}`}
                  defaultValue={day.game}
                  disabled={!day.stored || busy}
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
                run(() => setNightLocation(day.date, String(data.get("location") ?? "")))
              }}
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  maxLength={80}
                  key={`${day.date}-${day.location}`}
                  defaultValue={day.location}
                  disabled={!day.stored || busy}
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
