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
