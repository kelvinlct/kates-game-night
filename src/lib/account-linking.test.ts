import { describe, expect, it } from "vitest"
import { isAdminEmail } from "./admin"
import {
  canImplicitlyLinkAccount,
  googleAccountLinking,
  oauthErrorMessage,
} from "./account-linking"

describe("Google account linking", () => {
  it("refuses a verified Google email when the password user is unverified and Google is not trusted", () => {
    expect(
      canImplicitlyLinkAccount({
        providerId: "google",
        trustedProviders: [],
        providerEmailVerified: true,
        localEmailVerified: false,
        requireLocalEmailVerified: true,
      }),
    ).toBe(false)
  })

  it("still refuses when Google is trusted but the local email must already be verified", () => {
    expect(
      canImplicitlyLinkAccount({
        providerId: "google",
        trustedProviders: ["google"],
        providerEmailVerified: true,
        localEmailVerified: false,
        requireLocalEmailVerified: true,
      }),
    ).toBe(false)
  })

  it("links a verified Google email onto an unverified password user with the app config", () => {
    expect(
      canImplicitlyLinkAccount({
        providerId: "google",
        trustedProviders: googleAccountLinking.trustedProviders,
        providerEmailVerified: true,
        localEmailVerified: false,
        requireLocalEmailVerified: googleAccountLinking.requireLocalEmailVerified,
        linkingEnabled: googleAccountLinking.enabled,
      }),
    ).toBe(true)
  })

  it("does not treat a linked Google login as a change of admin email", () => {
    expect(isAdminEmail("curry@example.com", "curry@example.com")).toBe(true)
    expect(isAdminEmail("someone-else@example.com", "curry@example.com")).toBe(false)
  })
})

describe("OAuth error copy", () => {
  it("turns the raw link error into a sentence and hides unknown codes", () => {
    expect(oauthErrorMessage(null)).toBeNull()
    expect(oauthErrorMessage("")).toBeNull()
    expect(oauthErrorMessage("account_not_linked")).toMatch(/already has a login/i)
    expect(oauthErrorMessage("account_not_linked")).not.toMatch(/password/i)
    expect(oauthErrorMessage("account_not_linked")).not.toMatch(/account_not_linked/)
    expect(oauthErrorMessage("something_unexpected")).toMatch(/didn't work/i)
  })
})
