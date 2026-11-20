export function adminEmailList(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0)
}

/**
 * Admins are whoever is listed in ADMIN_EMAILS. Checked on the server
 * for every admin action, not stored as a role on the user.
 */
export function isAdminEmail(
  email: string | null | undefined,
  adminEmails: string | null | undefined = process.env.ADMIN_EMAILS,
): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return adminEmailList(adminEmails).includes(normalized)
}
