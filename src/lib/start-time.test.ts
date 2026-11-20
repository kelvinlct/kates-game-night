import { describe, expect, it } from "vitest"
import {
  defaultStartTime,
  effectiveStartTime,
  formatNightHeading,
  formatStartTime,
  parseStartTime,
} from "./start-time"

describe("start time defaults", () => {
  it("uses 7:00pm Monday through Friday", () => {
    expect(defaultStartTime("2026-11-20")).toBe("19:00")
    expect(defaultStartTime("2026-11-23")).toBe("19:00")
    expect(formatStartTime("19:00")).toBe("7:00pm")
  })

  it("uses 2:30pm on Saturday and Sunday", () => {
    expect(defaultStartTime("2026-11-21")).toBe("14:30")
    expect(defaultStartTime("2026-11-22")).toBe("14:30")
    expect(formatStartTime("14:30")).toBe("2:30pm")
  })

  it("falls back when a stored night has no time", () => {
    expect(effectiveStartTime(null, "2026-11-20")).toBe("19:00")
    expect(effectiveStartTime("", "2026-11-21")).toBe("14:30")
    expect(effectiveStartTime("nope", "2026-11-22")).toBe("14:30")
    expect(effectiveStartTime("18:15", "2026-11-20")).toBe("18:15")
  })

  it("parses a time input and formats the day heading", () => {
    expect(parseStartTime("19:00:00")).toBe("19:00")
    expect(parseStartTime("24:00")).toBeNull()
    expect(parseStartTime("7:00")).toBeNull()
    expect(formatNightHeading("2026-11-20", "7:00pm")).toBe("Friday, November 20 · 7:00pm")
    expect(formatNightHeading("2026-11-21", null)).toBe("Saturday, November 21")
  })
})
