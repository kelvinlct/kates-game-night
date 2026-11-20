import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function databaseUrl(env = process.env) {
  const value = (env.DATABASE_URL || env.POSTGRES_URL || "").trim()
  return value || undefined
}

function run(bin, args) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const url = databaseUrl()
if (url && !process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = url
}

// Keep this in step with shouldMigrateOnBuild in src/lib/database-url.ts.
if (process.env.VERCEL_ENV === "production" && url) {
  const drizzleBin = path.join(root, "node_modules", "drizzle-kit", "bin.cjs")
  if (!existsSync(drizzleBin)) {
    console.error("drizzle-kit is not installed, so production migrations cannot run.")
    process.exit(1)
  }
  run(drizzleBin, ["migrate"])
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next")
run(nextBin, ["build"])
