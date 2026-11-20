"use client"

import { useState, useTransition } from "react"
import { formatLongDate } from "@/lib/dates"
import type { ActionResult, AdminUser, DayView } from "@/lib/types"
import { removeBooking, setNightCapacity, setNightOpen, setUserVerified } from "@/server/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function AdminBoard({ days, users }: { days: DayView[]; users: AdminUser[] }) {
  const nights = days.filter((day) => day.inMonth)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(task: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await task()
      setError(result.ok ? null : result.error)
    })
  }

  return (
    <div className="flex flex-col gap-10">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <section>
        <h2 className="mb-3 font-heading text-2xl tracking-tight">Nights</h2>
        <div className="rounded-2xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Bookings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nights.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="whitespace-normal">{formatLongDate(day.date)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={day.status !== "closed"}
                      disabled={pending}
                      aria-label={`Open ${formatLongDate(day.date)}`}
                      onCheckedChange={(checked) => run(() => setNightOpen(day.date, checked))}
                    />
                  </TableCell>
                  <TableCell>{day.label ?? "Closed"}</TableCell>
                  <TableCell>
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const data = new FormData(event.currentTarget)
                        run(() => setNightCapacity(day.date, Number(data.get("capacity"))))
                      }}
                    >
                      <Input
                        name="capacity"
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={day.capacity}
                        key={`${day.date}-${day.capacity}`}
                        disabled={!day.stored || pending}
                        aria-label={`Capacity for ${formatLongDate(day.date)}`}
                        className="w-16"
                      />
                      <Button type="submit" size="sm" variant="outline" disabled={!day.stored || pending}>
                        Save
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {day.bookings.length === 0 ? (
                      <span className="text-muted-foreground">Just Kate</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {day.bookings.map((person) => (
                          <li key={person.id} className="flex items-center justify-between gap-3">
                            <span>{person.name ?? person.firstName}</span>
                            <button
                              type="button"
                              className="text-xs text-destructive underline-offset-2 hover:underline disabled:opacity-50"
                              disabled={pending}
                              onClick={() => run(() => removeBooking(person.id))}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-heading text-2xl tracking-tight">Registered friends</h2>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody has created an account yet.</p>
        ) : (
          <div className="rounded-2xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>{person.name}</TableCell>
                    <TableCell>{person.email}</TableCell>
                    <TableCell>
                      <Switch
                        checked={person.verified}
                        disabled={pending}
                        aria-label={`Verify ${person.name}`}
                        onCheckedChange={(checked) => run(() => setUserVerified(person.id, checked))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
