"use client"

import { useState, useTransition } from "react"
import { setUserDisplayName } from "@/server/actions"
import type { AdminUser } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function UserDirectory({ users }: { users: AdminUser[] }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody has created an account yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="rounded-2xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display name</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((person) => (
              <TableRow key={person.id}>
                <TableCell>
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const name = String(new FormData(event.currentTarget).get("name") ?? "")
                      startTransition(async () => {
                        const result = await setUserDisplayName(person.id, name)
                        setError(result.ok ? null : result.error)
                      })
                    }}
                  >
                    <Input
                      name="name"
                      required
                      maxLength={40}
                      key={`${person.id}-${person.name}`}
                      defaultValue={person.name}
                      disabled={pending}
                      aria-label={`Display name for ${person.email}`}
                      className="w-44"
                    />
                    <Button type="submit" size="sm" variant="outline" disabled={pending}>
                      Save
                    </Button>
                  </form>
                </TableCell>
                <TableCell className="text-muted-foreground">{person.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
