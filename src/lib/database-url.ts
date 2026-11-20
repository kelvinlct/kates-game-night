type Env = {
  DATABASE_URL?: string
  POSTGRES_URL?: string
  VERCEL_ENV?: string
  [key: string]: string | undefined
}

/** Neon on Vercel sets DATABASE_URL. Older integrations only set POSTGRES_URL. */
export function databaseUrl(env: Env = process.env): string | undefined {
  const value = (env.DATABASE_URL || env.POSTGRES_URL || "").trim()
  return value || undefined
}

/** Production builds migrate. Preview, development, and a missing URL do not. */
export function shouldMigrateOnBuild(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production" && Boolean(databaseUrl(env))
}
