"use client"

import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        verified: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
      },
    }),
  ],
})
