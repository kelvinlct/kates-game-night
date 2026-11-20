export const HOST_NAME = "Kate"

export function cleanName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ")
  if (name.length < 1 || name.length > 60) return null
  if (!/\p{L}/u.test(name)) return null
  return name
}

export function firstName(name: string): string {
  const cleaned = name.trim()
  const [first] = cleaned.split(/\s+/)
  return first || cleaned
}
