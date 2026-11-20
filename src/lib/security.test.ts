import { afterEach, describe, expect, it } from "vitest"
import {
  answersMatch,
  checkSecurityAnswer,
  isRateLimited,
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
  })

  it("reads SECURITY_ANSWER on the server and nowhere else", () => {
    process.env.SECURITY_ANSWER = "Lau"
    expect(checkSecurityAnswer(" lau ")).toBe(true)
    expect(checkSecurityAnswer("nope")).toBe(false)
    delete process.env.SECURITY_ANSWER
    expect(checkSecurityAnswer("Lau")).toBe(false)
  })

  it("locks out after the hourly failure limit", () => {
    expect(WRONG_ANSWER_LIMIT).toBe(5)
    expect(isRateLimited(4)).toBe(false)
    expect(isRateLimited(5)).toBe(true)
    expect(isRateLimited(6)).toBe(true)
  })
})
