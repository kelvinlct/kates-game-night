"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export function AuthForm({
  googleEnabled,
  nextPath,
  oauthError = null,
}: {
  googleEnabled: boolean
  nextPath: string
  oauthError?: string | null
}) {
  const [pending, setPending] = useState(false)
  const callbackURL = nextPath.startsWith("/") ? nextPath : "/"

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <h1 className="font-heading text-2xl tracking-tight">Sign in</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Friends can join without an account. Sign in with Google if you want a saved name.
      </p>
      {oauthError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {oauthError}
        </p>
      ) : null}
      {googleEnabled ? (
        <Button
          type="button"
          className="h-10 w-full"
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
          {pending ? "Please wait…" : "Sign in with Google"}
        </Button>
      ) : (
        <p className="text-sm text-foreground">
          Sign-in isn&apos;t configured. Google sign-in needs a client id and secret before anyone
          can log in.
        </p>
      )}
    </div>
  )
}
