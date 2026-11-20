import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url)
    const next = request.nextUrl.pathname
    url.searchParams.set("next", next.startsWith("/admin") ? next : "/admin")
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
