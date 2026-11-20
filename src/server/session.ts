import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { isAdminEmail } from "@/lib/admin"
import { getAuth } from "@/lib/auth"
import { bookModeFor } from "@/lib/join"
import type { Viewer } from "@/lib/types"

export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Await the request headers before touching the database. During
  // `next build` this suspends the prerender, so a missing database
  // does not fail the static shell.
  const headerStore = await headers()
  const session = await getAuth().api.getSession({
    headers: headerStore,
  })
  if (!session?.user) return null
  const email = session.user.email
  const verified = Boolean(session.user.verified)
  return {
    id: session.user.id,
    name: session.user.name,
    email,
    verified,
    isAdmin: isAdminEmail(email),
  }
})

export { bookModeFor }

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect("/login?next=/admin")
  if (!viewer.isAdmin) redirect("/")
  return viewer
}

export async function clientIp(): Promise<string> {
  const headerStore = await headers()
  const forwarded = headerStore.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headerStore.get("x-real-ip")?.trim() || "unknown"
}
