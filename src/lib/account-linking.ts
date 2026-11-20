/**
 * Better Auth refuses to attach a social login to an existing user unless
 * the provider is trusted or the provider email is verified, and, by default,
 * unless the existing row is already email-verified. Email/password signup
 * here does not verify email, so a later Google sign-in with the same address
 * returns "account not linked" unless Google is trusted and that local check
 * is off. After a successful link, Better Auth sets emailVerified when the
 * provider says the address is verified.
 */
export const googleAccountLinking = {
  enabled: true,
  trustedProviders: ["google"],
  requireLocalEmailVerified: false,
} as const

export function canImplicitlyLinkAccount(input: {
  providerId: string
  trustedProviders: readonly string[]
  providerEmailVerified: boolean
  localEmailVerified: boolean
  requireLocalEmailVerified: boolean
  linkingEnabled?: boolean
}): boolean {
  if (input.linkingEnabled === false) return false
  const trusted = input.trustedProviders.includes(input.providerId)
  const blockedBecauseUntrusted = !trusted && !input.providerEmailVerified
  const blockedBecauseLocalUnverified =
    input.requireLocalEmailVerified && !input.localEmailVerified
  return !blockedBecauseUntrusted && !blockedBecauseLocalUnverified
}

export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  switch (code) {
    case "account_not_linked":
      return "That Google account uses the same email as a password login, but they aren't connected yet. Sign in with your password, or try Google again."
    case "access_denied":
      return "Google sign-in was cancelled."
    case "unable_to_link_account":
    case "email_does_not_match":
    case "account_already_linked_to_different_user":
      return "We couldn't connect that Google account to this login."
    default:
      return "Google sign-in didn't work. Try again, or use your email and password."
  }
}
