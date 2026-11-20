import { describe, expect, it } from "vitest"
import { databaseUrl, shouldMigrateOnBuild } from "./database-url"

describe("database url", () => {
  it("prefers DATABASE_URL and falls back to POSTGRES_URL", () => {
    expect(databaseUrl({ DATABASE_URL: " postgres://primary ", POSTGRES_URL: "postgres://other" })).toBe(
      "postgres://primary",
    )
    expect(databaseUrl({ POSTGRES_URL: " postgres://fallback " })).toBe("postgres://fallback")
    expect(databaseUrl({})).toBeUndefined()
    expect(databaseUrl({ DATABASE_URL: "  ", POSTGRES_URL: "" })).toBeUndefined()
  })

  it("migrates only on a production build that has a database url", () => {
    expect(shouldMigrateOnBuild({ VERCEL_ENV: "production", DATABASE_URL: "postgres://db" })).toBe(true)
    expect(shouldMigrateOnBuild({ VERCEL_ENV: "production", POSTGRES_URL: "postgres://db" })).toBe(true)
    expect(shouldMigrateOnBuild({ VERCEL_ENV: "production" })).toBe(false)
    expect(shouldMigrateOnBuild({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://db" })).toBe(false)
    expect(shouldMigrateOnBuild({ DATABASE_URL: "postgres://db" })).toBe(false)
  })
})