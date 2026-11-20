export type DirectoryUser = {
  id: string
  name: string
  email: string
}

/** Case-insensitive match on display name or email. Blank query returns everyone, by name. */
export function filterDirectory(users: DirectoryUser[], query: string): DirectoryUser[] {
  const needle = query.trim().toLowerCase()
  const sorted = [...users].sort(
    (left, right) => left.name.localeCompare(right.name) || left.email.localeCompare(right.email),
  )
  if (!needle) return sorted
  return sorted.filter(
    (person) =>
      person.name.toLowerCase().includes(needle) || person.email.toLowerCase().includes(needle),
  )
}

/** Why an admin cannot add someone. Null means the seat can be taken. */
export function adminAddBlock(input: {
  open: boolean
  past: boolean
  full: boolean
  duplicateUser: boolean
}): string | null {
  if (!input.open) return "That night is closed."
  if (input.past) return "That night has already passed."
  if (input.duplicateUser) return "They're already in."
  if (input.full) return "That night is full."
  return null
}
