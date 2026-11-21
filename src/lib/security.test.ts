import { afterEach, describe, expect, it } from "vitest"
import {
  answersMatch,
  checkSecurityAnswer,
  formatWait,
  isRateLimited,
  lockoutFromFailures,
  lockoutMessage,
  LOCKOUT_STEPS_MS,
  QUIET_RESET_MS,
  WRONG_ANSWER_LIMIT,
} from "./security"

describe("security answer", () => {
  const previous = process.env.SECURITY_ANSWER

  afterEach(() => {
    if (previous === undefined) delete process.env.SECURITY_ANSWER
    else process.env.SECURITY_ANSWER = previous
  })

  it("matches after trim and case folding", () => {
    expect(answersMatch("  Lau ", "lau")).toBe(true)
    expect(answersMatch("LAU", "Lau")).toBe(true)
    expect(answersMatch("Émile", "émile")).toBe(true)
  })

  it("rejects a different answer, including one of a different length", () => {
    expect(answersMatch("Smith", "Lau")).toBe(false)
    expect(answersMatch("L", "Lau")).toBe(false)
    expect(answersMatch("", "Lau")).toBe(false)
  })

  it("rejects every answer when the expected value is missing", () => {
    expect(answersMatch("Lau", undefined)).toBe(false)
    expect(answersMatch("Lau", null)).toBe(false)
    expect(answersMatch("Lau", "   ")).toBe(false)
    expect(answersMatch("Lau", ", ,")).toBe(false)
    expect(answersMatch("", "Lau")).toBe(false)
  })

  it("accepts any comma-separated answer, including a second script", () => {
    const expected = " Yuen , 阮 "
    expect(answersMatch("yuen", expected)).toBe(true)
    expect(answersMatch("YUEN", expected)).toBe(true)
    expect(answersMatch("  阮  ", expected)).toBe(true)
    expect(answersMatch("Lau", expected)).toBe(false)
  })

  it("folds compatibility characters before comparing", () => {
    expect(answersMatch("\uFF39\uFF55\uFF45\uFF4E", "Yuen")).toBe(true)
    expect(answersMatch("Yuen", "Yuen\uFF0C\u962E")).toBe(true)
    expect(answersMatch("e\u0301mile", "Émile")).toBe(true)
  })

  it("reads SECURITY_ANSWER on the server and nowhere else", () => {
    process.env.SECURITY_ANSWER = "Lau"
    expect(checkSecurityAnswer(" lau ")).toBe(true)
    expect(checkSecurityAnswer("nope")).toBe(false)
    delete process.env.SECURITY_ANSWER
    expect(checkSecurityAnswer("Lau")).toBe(false)
  })

  it("still locks out after 5 wrong answers", () => {
    expect(WRONG_ANSWER_LIMIT).toBe(5)
    expect(isRateLimited(4)).toBe(false)
    expect(isRateLimited(5)).toBe(true)
  })
})

describe("escalating answer lockout", () => {
  const minute = 60 * 1000
  const batch = (start: number) => [0, 1, 2, 3, 4].map((second) => start + second * 1000)

  it("uses 5 minutes, then 15, 30, and 1 hour", () => {
    expect(LOCKOUT_STEPS_MS).toEqual([5 * minute, 15 * minute, 30 * minute, 60 * minute])
    const first = batch(0)
    const justLocked = lockoutFromFailures(first, 4_000)
    expect(justLocked.locked).toBe(true)
    expect(justLocked.waitMs).toBe(5 * minute - 0)
    expect(lockoutFromFailures(first, 5 * minute + 4_000).locked).toBe(false)

    const second = [...first, ...batch(10 * minute)]
    expect(lockoutFromFailures(second, 10 * minute + 4_000).waitMs).toBe(15 * minute)

    const third = [...second, ...batch(40 * minute)]
    expect(lockoutFromFailures(third, 40 * minute + 4_000).waitMs).toBe(30 * minute)

    const fourth = [...third, ...batch(80 * minute)]
    expect(lockoutFromFailures(fourth, 80 * minute + 4_000).waitMs).toBe(60 * minute)

    const fifth = [...fourth, ...batch(200 * minute)]
    expect(lockoutFromFailures(fifth, 200 * minute + 4_000).waitMs).toBe(60 * minute)
  })

  it("ignores tries during a lockout and resets after a day of quiet", () => {
    const first = batch(0)
    const during = [60_000, 61_000, 62_000, 63_000, 64_000]
    const after = batch(10 * minute)
    expect(lockoutFromFailures([...first, ...during, ...after], 10 * minute + 4_000).waitMs).toBe(15 * minute)

    const laterStart = 4_000 + QUIET_RESET_MS
    const later = batch(laterStart)
    expect(lockoutFromFailures([...first, ...later], laterStart + 4_000).waitMs).toBe(5 * minute)
    expect(lockoutFromFailures(first, 4_000 + QUIET_RESET_MS).locked).toBe(false)
  })

  it("says how long is left", () => {
    expect(lockoutMessage(5 * minute)).toBe("Too many tries. Try again in 5 minutes.")
    expect(lockoutMessage(minute + 1000)).toBe("Too many tries. Try again in 1 minute 1 second.")
    expect(lockoutMessage(30_000)).toBe("Too many tries. Try again in 30 seconds.")
    expect(lockoutMessage(60 * minute)).toBe("Too many tries. Try again in 1 hour.")
    expect(formatWait(500)).toBe("1 second")
  })
})
