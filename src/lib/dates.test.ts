import { describe, expect, it } from "vitest"
import {
  formatLongDate,
  isPastDate,
  monthGrid,
  parseMonth,
  shiftMonth,
  todayInToronto,
} from "./dates"

describe("Toronto calendar dates", () => {
  it("keeps the calendar date in America/Toronto across midnight UTC", () => {
    // 10:30pm Eastern on Nov 20 is still the 20th, even though UTC is the 21st.
    expect(todayInToronto(new Date("2026-11-21T03:30:00.000Z"))).toBe("2026-11-20")
    // 12:30am Eastern on Nov 21.
    expect(todayInToronto(new Date("2026-11-21T05:30:00.000Z"))).toBe("2026-11-21")
  })

  it("treats today as bookable and yesterday as past", () => {
    expect(isPastDate("2026-11-19", "2026-11-20")).toBe(true)
    expect(isPastDate("2026-11-20", "2026-11-20")).toBe(false)
    expect(isPastDate("2026-11-21", "2026-11-20")).toBe(false)
  })

  it("builds November 2026 as a Sunday-first grid without shifting the first", () => {
    const cells = monthGrid(2026, 11)
    expect(cells).toHaveLength(35)
    expect(cells[0]).toEqual({ date: "2026-11-01", inMonth: true })
    expect(cells[19]).toEqual({ date: "2026-11-20", inMonth: true })
    expect(cells[29]).toEqual({ date: "2026-11-30", inMonth: true })
    expect(cells[30]).toEqual({ date: "2026-12-01", inMonth: false })
    expect(cells[34]).toEqual({ date: "2026-12-05", inMonth: false })
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(30)
  })

  it("formats a calendar date without moving it to the previous day", () => {
    expect(formatLongDate("2026-11-20")).toBe("Friday, November 20")
  })

  it("steps months and falls back to the Toronto month when the query is junk", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2026, month: 12 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(parseMonth("2026-11", "2026-03-04")).toEqual({ year: 2026, month: 11 })
    expect(parseMonth("nope", "2026-03-04")).toEqual({ year: 2026, month: 3 })
    expect(parseMonth("2026-13", "2026-03-04")).toEqual({ year: 2026, month: 3 })
  })
})
