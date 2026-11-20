import { toNextJsHandler } from "better-auth/next-js"
import { getAuth } from "@/lib/auth"

type Handler = ReturnType<typeof toNextJsHandler>

let routes: Handler | null = null

function handlers(): Handler {
  if (!routes) routes = toNextJsHandler(getAuth())
  return routes
}

export const GET = (request: Request) => handlers().GET(request)
export const POST = (request: Request) => handlers().POST(request)
export const PATCH = (request: Request) => handlers().PATCH(request)
export const PUT = (request: Request) => handlers().PUT(request)
export const DELETE = (request: Request) => handlers().DELETE(request)
