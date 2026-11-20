import { describe, expect, it } from "vitest"
import { adminAddBlock, filterDirectory, type DirectoryUser } from "./admin-add"

const people: DirectoryUser[] = [
  { id: "2", name: "Sam Chen", email: "sam@example.com" },
  { id: "1", name: "Alex", email: "alex@example.com" },
  { id: "3", name: "Mina", email: "sam.friend@example.com" },
]

describe("admin add", () => {
  it("searches display names and emails", () => {
    expect(filterDirectory(people, "").map((person) => person.name)).toEqual(["Alex", "Mina", "Sam Chen"])
    expect(filterDirectory(people, "  sam ").map((person) => person.id)).toEqual(["3", "2"])
    expect(filterDirectory(people, "ALEX@example.com").map((person) => person.id)).toEqual(["1"])
    expect(filterDirectory(people, "nobody")).toEqual([])
  })

  it("blocks a closed, past, duplicate, or full night", () => {
    expect(adminAddBlock({ open: false, past: false, full: false, duplicateUser: false })).toBe(
      "That night is closed.",
    )
    expect(adminAddBlock({ open: true, past: true, full: false, duplicateUser: false })).toBe(
      "That night has already passed.",
    )
    expect(adminAddBlock({ open: true, past: false, full: true, duplicateUser: true })).toBe(
      "They're already in.",
    )
    expect(adminAddBlock({ open: true, past: false, full: true, duplicateUser: false })).toBe(
      "That night is full.",
    )
    expect(adminAddBlock({ open: true, past: false, full: false, duplicateUser: false })).toBeNull()
  })
})
