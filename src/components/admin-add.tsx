"use client"

import { useState, useTransition } from "react"
import { filterDirectory, type DirectoryUser } from "@/lib/admin-add"
import { addGuestName, addRegisteredUser } from "@/server/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const VISIBLE = 8

export function AdminAdd({
  date,
  users,
  bookedUserIds,
}: {
  date: string
  users: DirectoryUser[]
  bookedUserIds: string[]
}) {
  const [query, setQuery] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [guestKey, setGuestKey] = useState(0)
  const [pending, startTransition] = useTransition()
  const taken = new Set(bookedUserIds)
  const matches = filterDirectory(
    users.filter((person) => !taken.has(person.id)),
    query,
  ).slice(0, VISIBLE)

  function finish(result: { ok: true } | { ok: false; error: string }, clearGuest: boolean) {
    setAdded(result.ok)
    setNotice(result.ok ? "Added." : result.error)
    if (result.ok && clearGuest) setGuestKey((key) => key + 1)
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Add someone</p>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          startTransition(async () => {
            finish(await addGuestName(date, String(data.get("name") ?? "")), true)
          })
        }}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="admin-guest-name">Name, no account</Label>
          <Input
            id="admin-guest-name"
            name="name"
            key={guestKey}
            required
            maxLength={40}
            disabled={pending}
            placeholder="First name"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          Add
        </Button>
      </form>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-user-search">Registered</Label>
        <Input
          id="admin-user-search"
          value={query}
          disabled={pending}
          placeholder="Search name or email"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one matches.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      finish(await addRegisteredUser(date, person.id), false)
                    })
                  }}
                >
                  <span>{person.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{person.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {notice ? (
        <p role="alert" className={added ? "text-sm text-primary" : "text-sm text-destructive"}>
          {notice}
        </p>
      ) : null}
    </div>
  )
}
