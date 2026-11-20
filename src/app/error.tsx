"use client"

import { buttonVariants } from "@/components/ui/button"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-16">
      <h1 className="font-heading text-3xl tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page couldn&apos;t load. If this is a fresh setup, check that DATABASE_URL is set and
        migrations have been run.
      </p>
      <button type="button" onClick={reset} className={buttonVariants()}>
        Try again
      </button>
    </div>
  )
}
