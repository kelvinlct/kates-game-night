import { describe, expect, it } from "vitest"
import { emailAndPasswordEnabled } from "./auth-mode"

describe("sign-in mode", () => {
  it("rejects email and password on the server", () => {
    expect(emailAndPasswordEnabled).toBe(false)
  })
})
