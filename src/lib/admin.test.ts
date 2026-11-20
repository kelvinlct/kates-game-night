import { afterEach, describe, expect, it } from "vitest"
import { isAdminEmail } from "./admin"

describe("admin emails", () => {
  const previous = process.env.ADMIN_EMAILS

  afterEach(() => {
    if (previous === undefined) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = previous
  })

  it("matches a listed email, ignoring case and surrounding spaces", () => {
    const list = " Kate@Example.com, other@example.com "
    expect(isAdminEmail("kate@example.com", list)).toBe(true)
    expect(isAdminEmail("  OTHER@example.com ", list)).toBe(true)
  })

  it("does not match a partial or neighbouring address", () => {
    const list = "kate@example.com"
    expect(isAdminEmail("notkate@example.com", list)).toBe(false)
    expect(isAdminEmail("kate@example.com.evil", list)).toBe(false)
    expect(isAdminEmail("kate@example.co", list)).toBe(false)
  })

  it("rejects empty input and an empty allow list", () => {
    expect(isAdminEmail(null, "kate@example.com")).toBe(false)
    expect(isAdminEmail("", "kate@example.com")).toBe(false)
    expect(isAdminEmail("kate@example.com", "")).toBe(false)
    expect(isAdminEmail("kate@example.com", null)).toBe(false)
    expect(isAdminEmail("kate@example.com", ", ,")).toBe(false)
  })

  it("rejects everyone when ADMIN_EMAILS is unset", () => {
    delete process.env.ADMIN_EMAILS
    expect(isAdminEmail("kate@example.com")).toBe(false)
  })

  it("reads ADMIN_EMAILS from the environment", () => {
    process.env.ADMIN_EMAILS = "kate@example.com,sam@example.com"
    expect(isAdminEmail("sam@example.com")).toBe(true)
    expect(isAdminEmail("guest@example.com")).toBe(false)
  })
})
