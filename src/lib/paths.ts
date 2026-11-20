export function safeNextPath(value: string | undefined): string {
  if (!value) return "/"
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/"
  }
  if (value.includes("://")) return "/"
  return value
}

export function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}
