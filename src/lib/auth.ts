import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { googleAccountLinking } from "@/lib/account-linking"
import { emailAndPasswordEnabled } from "@/lib/auth-mode"
import { authSchema } from "@/db/schema"
import { getDb } from "@/db"

export function isGoogleEnabled(
  clientId = process.env.GOOGLE_CLIENT_ID,
  clientSecret = process.env.GOOGLE_CLIENT_SECRET,
): boolean {
  return Boolean(clientId && clientSecret)
}

function trustedOrigins(): string[] {
  const origins = new Set<string>(["http://localhost:3000"])
  if (process.env.BETTER_AUTH_URL) origins.add(process.env.BETTER_AUTH_URL)
  return [...origins]
}

function createAuth() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
  const google = isGoogleEnabled(googleClientId, googleClientSecret)
    ? {
        google: {
          clientId: googleClientId as string,
          clientSecret: googleClientSecret as string,
        },
      }
    : undefined

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins(),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: emailAndPasswordEnabled,
    },
    account: {
      accountLinking: {
        enabled: googleAccountLinking.enabled,
        trustedProviders: [...googleAccountLinking.trustedProviders],
        requireLocalEmailVerified: googleAccountLinking.requireLocalEmailVerified,
      },
    },
    socialProviders: google,
    onAPIError: {
      errorURL: "/login",
    },
    user: {
      additionalFields: {
        verified: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    plugins: [nextCookies()],
  })
}

type AuthInstance = ReturnType<typeof createAuth>

const globalAuth = globalThis as unknown as { katesAuth?: AuthInstance }

export function getAuth(): AuthInstance {
  if (!globalAuth.katesAuth) globalAuth.katesAuth = createAuth()
  return globalAuth.katesAuth
}
