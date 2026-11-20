import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"
import { AdminBoard } from "@/components/admin-board"
import { HeaderAuth } from "@/components/header-auth"
import { MonthPager } from "@/components/month-pager"
import { SiteFrame } from "@/components/site-frame"
import { buttonVariants } from "@/components/ui/button"
import { parseMonth, todayInToronto } from "@/lib/dates"
import { firstQueryValue } from "@/lib/paths"
import { getMonth, listUsers } from "@/server/queries"
import { requireAdmin } from "@/server/session"

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <SiteFrame
      aside={
        <Suspense fallback={<div className="h-8 w-24 rounded-lg bg-muted" />}>
          <HeaderAuth />
        </Suspense>
      }
    >
      <Suspense fallback={<div className="h-96 rounded-2xl bg-card ring-1 ring-foreground/10" />}>
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </SiteFrame>
  )
}

async function AdminContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = await searchParams
  const viewer = await requireAdmin()
  const today = todayInToronto()
  const { year, month } = parseMonth(firstQueryValue(params.month), today)
  const [data, users] = await Promise.all([
    getMonth(year, month, viewer, today),
    listUsers(),
  ])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open nights, set the table size, and mark friends as verified.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Users
          </Link>
          <Link href="/admin/history" className={buttonVariants({ variant: "outline", size: "sm" })}>
            History
          </Link>
          <Link href={`/?month=${data.monthKey}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to calendar
          </Link>
        </div>
      </div>
      <MonthPager
        label={data.label}
        prevHref={`/admin?month=${data.prevKey}`}
        nextHref={`/admin?month=${data.nextKey}`}
      />
      <AdminBoard days={data.days} users={users} />
    </div>
  )
}
