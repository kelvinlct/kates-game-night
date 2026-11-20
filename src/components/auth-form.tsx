"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AuthForm({
  mode,
  googleEnabled,
  nextPath,
  oauthError = null,
}: {
  mode: "login" | "signup"
  googleEnabled: boolean
  nextPath: string
  oauthError?: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const callbackURL = nextPath.startsWith("/") ? nextPath : "/"

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    const name = String(form.get("name") ?? "")
    const result =
      mode === "login"
        ? await authClient.signIn.email({ email, password, callbackURL })
        : await authClient.signUp.email({ email, password, name, callbackURL })
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.")
      setPending(false)
      return
    }
    router.refresh()
    router.push(callbackURL)
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <h1 className="font-heading text-2xl tracking-tight">
        {mode === "login" ? "Log in" : "Create an account"}
      </h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        {mode === "login"
          ? "Friends can book without an account. Log in if Kate has verified you."
          : "A verified account can book a seat in one click."}
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === "signup" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        {error || oauthError ? (
          <p role="alert" className="text-sm text-destructive">
            {error ?? oauthError}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="h-10">
          {pending ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </Button>
      </form>
      {googleEnabled ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-10 w-full"
          disabled={pending}
          onClick={() => {
            setPending(true)
            void authClient.signIn.social({
              provider: "google",
              callbackURL,
              errorCallbackURL: `/login?next=${encodeURIComponent(callbackURL)}`,
            })
          }}
        >
          Continue with Google
        </Button>
      ) : null}
      <p className="mt-4 text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href={`/signup?next=${encodeURIComponent(callbackURL)}`} className="text-foreground underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(callbackURL)}`} className="text-foreground underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
