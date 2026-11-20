import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless"
import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless"
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres"
import { Pool as PgPool } from "pg"
import ws from "ws"
import * as schema from "@/db/schema"
import { databaseUrl } from "@/lib/database-url"

export type AppDatabase = NeonDatabase<typeof schema>

const globalDb = globalThis as unknown as {
  katesDb?: AppDatabase
  katesDbUrl?: string
}

function isNeonHost(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.endsWith("neon.tech")
  } catch {
    return connectionString.includes("neon.tech")
  }
}

function createDb(connectionString: string): AppDatabase {
  if (isNeonHost(connectionString)) {
    // WebSocket pool, not the HTTP driver: bookings need an interactive
    // transaction and SELECT ... FOR UPDATE, which the HTTP driver cannot do.
    neonConfig.webSocketConstructor = ws
    const pool = new NeonPool({ connectionString, max: 1 })
    return drizzleNeon(pool, { schema })
  }

  // A local Postgres speaks the wire protocol. The Neon driver does not,
  // so development and CI use node-postgres. The transaction API is the same.
  const pool = new PgPool({ connectionString, max: 5 })
  return drizzleNode(pool, { schema }) as unknown as AppDatabase
}

export function getDb(): AppDatabase {
  const connectionString = databaseUrl()
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }
  if (!globalDb.katesDb || globalDb.katesDbUrl !== connectionString) {
    globalDb.katesDb = createDb(connectionString)
    globalDb.katesDbUrl = connectionString
  }
  return globalDb.katesDb
}
