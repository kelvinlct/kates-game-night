import { Suspense } from "react"
import { connection } from "next/server"
import { HeaderAuth } from "@/components/header-auth"
import { Legend } from "@/components/legend"
import { SiteFrame } from "@/components/site-frame"
import { SwipeableCalendar } from "@/components/swipeable-calendar"
import { parseMonth, todayInToronto } from "@/lib/dates"
import { firstQueryValue } from "@/lib/paths"
import { getMonth, listUsers } from "@/server/queries"
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

  // 假設 month 係 1–12；如果 dates.ts 係 0–11，改為 0 / 11
  const prevTarget = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const nextTarget = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }

  const [prevData, data, nextData, users] = await Promise.all([
    getMonth(prevTarget.year, prevTarget.month, viewer, today),
    getMonth(year, month, viewer, today),
    getMonth(nextTarget.year, nextTarget.month, viewer, today),
    viewer?.isAdmin ? listUsers() : Promise.resolve([]),
  ])

  return (
    <SwipeableCalendar
      prev={{
        label: prevData.label,
        days: prevData.days,
        prevKey: prevData.prevKey,
        nextKey: prevData.nextKey,
      }}
      current={{
        label: data.label,
        days: data.days,
        prevKey: data.prevKey,
        nextKey: data.nextKey,
      }}
      next={{
        label: nextData.label,
        days: nextData.days,
        prevKey: nextData.prevKey,
        nextKey: nextData.nextKey,
      }}
      bookMode={data.bookMode}
      viewerName={data.viewerName}
      isAdmin={data.isAdmin}
      directory={users.map(({ id, name, email }) => ({ id, name, email }))}
    />
  )
}

function CalendarSkeleton() {
  return <div className="h-[28rem] rounded-2xl bg-card ring-1 ring-foreground/10" />
}
