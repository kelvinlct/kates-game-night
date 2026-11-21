"use client"

import { useState } from "react"
import { WEEKDAYS, dayOfMonth, formatLongDate } from "@/lib/dates"
import type { DirectoryUser } from "@/lib/admin-add"
import type { BookMode, DayView } from "@/lib/types"
import { BookingDialog } from "@/components/booking-dialog"

function cellClass(day: DayView): string {
  if (!day.inMonth) return "bg-transparent text-muted-foreground/50"
  if (day.status === "open") return "bg-[#d7efe2] text-[#143526] hover:bg-[#c9e7d6]"
  if (day.status === "full") return "bg-[#f6d9d4] text-[#6d2424] hover:bg-[#f0c9c3]"
  return "bg-[#e4ddd2] text-[#7d756b]"
}

function labelFor(day: DayView): string {
  const when = day.timeLabel ? `${formatLongDate(day.date)} at ${day.timeLabel}` : formatLongDate(day.date)
  if (!day.inMonth) return when
  if (day.status === "closed") return `${when}, closed`
  if (day.status === "full") return `${when}, ${day.label}, game confirmed`
  return `${when}, ${day.label}`
}

export function MonthGrid({
  days,
  monthLabel,
  bookMode,
  viewerName,
  isAdmin,
  directory = [],
}: {
  days: DayView[]
  monthLabel: string
  bookMode: BookMode
  viewerName: string | null
  isAdmin: boolean
  directory?: DirectoryUser[]
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedDay = days.find((day) => day.date === selected) ?? null
  const weeks: DayView[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return (
    <>
      <table className="w-full table-fixed border-separate border-spacing-1 sm:border-spacing-1.5">
        <caption className="sr-only">{monthLabel} game nights</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th
                key={weekday}
                scope="col"
                className="pb-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((day) => {
                const interactive = day.inMonth && (day.status !== "closed" || isAdmin)
                const className = `flex h-16 w-full flex-col items-start overflow-hidden rounded-lg p-1.5 text-left sm:h-24 sm:p-2 ${cellClass(day)} ${
                  day.isToday ? "ring-2 ring-foreground ring-inset" : ""
                }`
                return (
                  <td key={day.date} className="p-0 align-top">
                    {interactive ? (
                      <button
                        type="button"
                        className={className}
                        aria-label={labelFor(day)}
                        aria-current={day.isToday ? "date" : undefined}
                        onClick={() => setSelected(day.date)}
                      >
                        <DayBody day={day} />
                      </button>
                    ) : (
                      <div className={className} aria-hidden={!day.inMonth}>
                        <DayBody day={day} />
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {selectedDay ? (
        <BookingDialog
          key={selectedDay.date}
          day={selectedDay}
          open
          onOpenChange={(next) => {
            if (!next) setSelected(null)
          }}
          bookMode={bookMode}
          viewerName={viewerName}
          isAdmin={isAdmin}
          directory={directory}
        />
      ) : null}
    </>
  )
}

function DayBody({ day }: { day: DayView }) {
  return (
    <>
      <span className="text-xs font-medium sm:text-sm">{dayOfMonth(day.date)}</span>
      {day.inMonth && day.status === "closed" ? (
        <span className="mt-auto text-[10px] tracking-wide uppercase">Closed</span>
      ) : null}
      {day.inMonth && day.status === "open" ? (
        <span className="mt-auto truncate text-sm leading-none font-semibold">{day.label}</span>
      ) : null}
      {day.inMonth && day.status === "full" ? (
        <>
          <span className="mt-auto truncate text-sm leading-none font-semibold">{day.label}</span>
          <span className="hidden truncate text-[10px] leading-none sm:block">Game confirmed</span>
        </>
      ) : null}
    </>
  )
}
