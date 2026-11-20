"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { buttonVariants } from "@/components/ui/button"

export function SignedInMenu({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {isAdmin ? (
        <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Admin
        </Link>
      ) : null}
      <span className="max-w-28 truncate text-sm text-foreground sm:max-w-48">{name}</span>
      <button
        type="button"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        onClick={() => {
          void authClient.signOut().then(() => {
            router.refresh()
            router.push("/")
          })
        }}
      >
        Log out
      </button>
    </div>
  )
}
