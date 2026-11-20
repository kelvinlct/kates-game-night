"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { updateDisplayName } from "@/server/actions"
import { buttonVariants } from "@/components/ui/button"
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

export function SignedInMenu({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {isAdmin ? (
        <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Admin
        </Link>
      ) : null}
      <button
        type="button"
        className="max-w-28 truncate text-sm text-foreground underline-offset-2 hover:underline sm:max-w-48"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        {name}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Your name</DialogTitle>
            <DialogDescription>This is the name friends see on a game night.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const value = String(new FormData(event.currentTarget).get("name") ?? "")
              setPending(true)
              setError(null)
              void updateDisplayName(value).then((result) => {
                setPending(false)
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                setOpen(false)
                router.refresh()
              })
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                name="name"
                required
                maxLength={40}
                key={name}
                defaultValue={name}
                autoComplete="name"
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending} className="h-10">
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              void authClient.signOut().then(() => {
                router.refresh()
                router.push("/")
              })
            }}
          >
            Sign out
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}