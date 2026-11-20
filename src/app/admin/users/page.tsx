import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"
import { HeaderAuth } from "@/components/header-auth"
import { SiteFrame } from "@/components/site-frame"
import { UserDirectory } from "@/components/user-directory"
import { buttonVariants } from "@/components/ui/button"
import { listUsers } from "@/server/queries"
import { requireAdmin } from "@/server/session"

export default function UsersPage() {
  return (
    <SiteFrame
      aside={
        <Suspense fallback={<div className="h-8 w-24 rounded-lg bg-muted" />}>
          <HeaderAuth />
        </Suspense>
      }
    >
      <Suspense fallback={<div className="h-96 rounded-2xl bg-card ring-1 ring-foreground/10" />}>
        <UsersContent />
      </Suspense>
    </SiteFrame>
  )
}

async function UsersContent() {
  await connection()
  await requireAdmin("/admin/users")
  const users = await listUsers()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Display names are what friends see on a night. 1 to 40 characters.
          </p>
        </div>
        <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to admin
        </Link>
      </div>
      <UserDirectory users={users} />
    </div>
  )
}
