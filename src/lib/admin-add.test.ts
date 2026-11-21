import { describe, expect, it } from "vitest"
import { filterDirectory, type DirectoryUser } from "./admin-add"

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

})
