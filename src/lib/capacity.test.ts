import { describe, expect, it } from "vitest"
import {
  bookedCount,
  countLabel,
  DEFAULT_CAPACITY,
  isFull,
  parseCapacity,
  spotsLeft,
  statusFor,
} from "./capacity"

describe("capacity", () => {
  it("counts Kate as seat 1, so an empty open table is 1/4", () => {
    expect(DEFAULT_CAPACITY).toBe(4)
    expect(bookedCount(0)).toBe(1)
    expect(spotsLeft(4, 0)).toBe(3)
    expect(isFull(4, 0)).toBe(false)
    expect(statusFor(true, 4, 0)).toBe("open")
    expect(countLabel(4, 0)).toBe("1/4")
  })

  it("is full when guests fill every seat besides Kate", () => {
    expect(bookedCount(3)).toBe(4)
    expect(spotsLeft(4, 3)).toBe(0)
    expect(isFull(4, 3)).toBe(true)
    expect(statusFor(true, 4, 3)).toBe("full")
    expect(countLabel(4, 3)).toBe("4/4")
  })

  it("stays open while a seat remains", () => {
    expect(spotsLeft(4, 2)).toBe(1)
    expect(statusFor(true, 4, 2)).toBe("open")
    expect(countLabel(4, 2)).toBe("3/4")
  })

  it("treats capacity 1 as Kate only, so the night is already full", () => {
    expect(spotsLeft(1, 0)).toBe(0)
    expect(statusFor(true, 1, 0)).toBe("full")
    expect(countLabel(1, 0)).toBe("1/1")
  })

  it("stays closed when the night is not open, even if the math would be full", () => {
    expect(statusFor(false, 4, 3)).toBe("closed")
    expect(statusFor(false, 4, 0)).toBe("closed")
  })

  it("treats a shrunk capacity as full", () => {
    expect(spotsLeft(3, 3)).toBe(-1)
    expect(isFull(3, 3)).toBe(true)
    expect(statusFor(true, 3, 3)).toBe("full")
  })

  it("parses a capacity between 1 and 20", () => {
    expect(parseCapacity("4")).toBe(4)
    expect(parseCapacity(1)).toBe(1)
    expect(parseCapacity(20)).toBe(20)
    expect(parseCapacity("0")).toBeNull()
    expect(parseCapacity("21")).toBeNull()
    expect(parseCapacity("4.5")).toBeNull()
    expect(parseCapacity("")).toBeNull()
    expect(parseCapacity("nope")).toBeNull()
  })
})
