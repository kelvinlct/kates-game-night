import { describe, expect, it } from "vitest"
import {
  adminPlacement,
  createNightGate,
  peopleToPromote,
  selfPlacement,
  withNightLock,
} from "./waitlist"

describe("waiting list placement", () => {
  it("sends a full night to the waiting list and blocks duplicates", () => {
    expect(
      selfPlacement({
        open: true,
        past: false,
        full: true,
        waitlistEnabled: true,
        alreadyBooked: false,
        alreadyWaiting: false,
      }),
    ).toEqual({ ok: true, place: "wait" })
    expect(
      selfPlacement({
        open: true,
        past: false,
        full: false,
        waitlistEnabled: true,
        alreadyBooked: false,
        alreadyWaiting: false,
      }),
    ).toEqual({ ok: true, place: "seat" })
    expect(
      selfPlacement({
        open: true,
        past: false,
        full: false,
        waitlistEnabled: true,
        alreadyBooked: true,
        alreadyWaiting: false,
      }),
    ).toEqual({ ok: false, error: "You're already in." })
    expect(
      selfPlacement({
        open: true,
        past: false,
        full: true,
        waitlistEnabled: true,
        alreadyBooked: false,
        alreadyWaiting: true,
      }),
    ).toEqual({ ok: false, error: "You're already on the waiting list." })
    expect(
      selfPlacement({
        open: true,
        past: false,
        full: true,
        waitlistEnabled: false,
        alreadyBooked: false,
        alreadyWaiting: false,
      }),
    ).toEqual({ ok: false, error: "That night is full." })
  })

  it("lets an admin add to the waiting list when the night is full", () => {
    expect(
      adminPlacement({
        open: true,
        past: false,
        full: true,
        waitlistEnabled: true,
        alreadyBooked: false,
        alreadyWaiting: false,
      }),
    ).toEqual({ ok: true, place: "wait" })
    expect(
      adminPlacement({
        open: true,
        past: false,
        full: true,
        waitlistEnabled: false,
        alreadyBooked: false,
        alreadyWaiting: false,
      }),
    ).toEqual({ ok: false, error: "That night is full." })
    expect(
      adminPlacement({
        open: true,
        past: false,
        full: true,
        waitlistEnabled: true,
        alreadyBooked: true,
        alreadyWaiting: false,
      }),
    ).toEqual({ ok: false, error: "They're already in." })
    expect(
      adminPlacement({
        open: true,
        past: false,
        full: false,
        waitlistEnabled: true,
        alreadyBooked: false,
        alreadyWaiting: true,
      }),
    ).toEqual({ ok: false, error: "They're already on the waiting list." })
  })

  it("promotes the earliest waiters and only as many as the open seats", () => {
    expect(peopleToPromote(4, 3, ["a", "b"])).toEqual([])
    expect(peopleToPromote(4, 2, ["a", "b", "c"])).toEqual(["a"])
    expect(peopleToPromote(6, 2, ["a", "b", "c"])).toEqual(["a", "b", "c"])
  })

  it("promotes a different person for each concurrent removal", async () => {
    const gate = createNightGate()
    const state = { booked: ["a", "b"], waiting: ["c", "d"], capacity: 3 }

    async function remove(id: string) {
      return withNightLock(gate, async () => {
        await Promise.resolve()
        state.booked = state.booked.filter((person) => person !== id)
        const promoted = peopleToPromote(state.capacity, state.booked.length, state.waiting)
        const chosen = new Set(promoted)
        state.waiting = state.waiting.filter((person) => !chosen.has(person))
        state.booked.push(...promoted)
        return promoted
      })
    }

    const [first, second] = await Promise.all([remove("a"), remove("b")])
    expect(first).toEqual(["c"])
    expect(second).toEqual(["d"])
    expect(state.waiting).toEqual([])
    expect(state.booked).toEqual(["c", "d"])
  })
})
