import { Suspense } from "react"
import { connection } from "next/server"
import { HeaderAuth } from "@/components/header-auth"
import { Legend } from "@/components/legend"
import { MonthGrid } from "@/components/month-grid"
import { MonthPager } from "@/components/month-pager"
import { SiteFrame } from "@/components/site-frame"
import { parseMonth, todayInToronto } from "@/lib/dates"
import { firstQueryValue } from "@/lib/paths"
import { getMonth } from "@/server/queries"
import { getViewer } from "@/server/session"

export default function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <SiteFrame
      aside={
        <Suspense fallback={<div className="h-8 w-20 rounded-lg bg-muted" />}>
          <HeaderAuth />
        </Suspense>
      }
    >
      <Suspense fallback={<CalendarSkeleton />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
      <Legend />
      <p className="mt-3 max-w-xl text-xs text-muted-foreground">
        Kate holds seat 1, so an open night with nobody else in shows 1/4. Gray nights are closed.
        You can join without an account.
      </p>
    </SiteFrame>
  )
}

async function Calendar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = await searchParams
  const viewer = await getViewer()
  const today = todayInToronto()
  const { year, month } = parseMonth(firstQueryValue(params.month), today)
  const data = await getMonth(year, month, viewer, today)
  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 sm:p-5">
      <MonthPager
        label={data.label}
        prevHref={`/?month=${data.prevKey}`}
        nextHref={`/?month=${data.nextKey}`}
      />
      <MonthGrid
        days={data.days}
        monthLabel={data.label}
        bookMode={data.bookMode}
        viewerName={data.viewerName}
        isAdmin={data.isAdmin}
      />
    </div>
  )
}

function CalendarSkeleton() {
  return <div className="h-[28rem] rounded-2xl bg-card ring-1 ring-foreground/10" />
}
