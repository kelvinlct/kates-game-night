import { NextRequest, NextResponse } from "next/server"
import { parseMonth, todayInToronto } from "@/lib/dates"
import { getMonth } from "@/server/queries"
import { getViewer } from "@/server/session"

function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
}

export async function GET(request: NextRequest) {
  const rawMonth = request.nextUrl.searchParams.get("month") ?? undefined
  const viewer = await getViewer()
  const today = todayInToronto()
  const { year, month } = parseMonth(rawMonth, today)
  const data = await getMonth(year, month, viewer, today)

  return NextResponse.json(
    {
      key: nextMonthKey(data.prevKey),
      label: data.label,
      days: data.days,
      prevKey: data.prevKey,
      nextKey: data.nextKey,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
