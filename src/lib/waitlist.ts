import { spotsLeft } from "@/lib/capacity"

export type SeatPlace = "seat" | "wait"

export function selfPlacement(input: {
  open: boolean
  past: boolean
  full: boolean
  waitlistEnabled: boolean
  alreadyBooked: boolean
  alreadyWaiting: boolean
}): { ok: true; place: SeatPlace } | { ok: false; error: string } {
  if (!input.open) return { ok: false, error: "That night is closed." }
  if (input.past) return { ok: false, error: "That night has already passed." }
  if (input.alreadyBooked) return { ok: false, error: "You're already in." }
  if (input.alreadyWaiting) return { ok: false, error: "You're already on the waiting list." }
  if (input.full && !input.waitlistEnabled) return { ok: false, error: "That night is full." }
  return { ok: true, place: input.full ? "wait" : "seat" }
}

export function adminPlacement(input: {
  open: boolean
  past: boolean
  full: boolean
  waitlistEnabled: boolean
  alreadyBooked: boolean
  alreadyWaiting: boolean
}): { ok: true; place: SeatPlace } | { ok: false; error: string } {
  if (!input.open) return { ok: false, error: "That night is closed." }
  if (input.past) return { ok: false, error: "That night has already passed." }
  if (input.alreadyBooked) return { ok: false, error: "They're already in." }
  if (input.alreadyWaiting) return { ok: false, error: "They're already on the waiting list." }
  if (input.full && !input.waitlistEnabled) return { ok: false, error: "That night is full." }
  return { ok: true, place: input.full ? "wait" : "seat" }
}

/** The earliest waiters who fit in the open seats. `waiting` is already in join order. */
export function peopleToPromote<T>(capacity: number, booked: number, waiting: readonly T[]): T[] {
  const open = Math.max(0, spotsLeft(capacity, booked))
  return waiting.slice(0, open)
}

export type NightGate = { tail: Promise<void> }

export function createNightGate(): NightGate {
  return { tail: Promise.resolve() }
}

/** Same idea as locking the night row: the next caller waits until this task finishes. */
export function withNightLock<T>(gate: NightGate, task: () => Promise<T>): Promise<T> {
  const previous = gate.tail
  let release: () => void = () => {}
  gate.tail = new Promise<void>((resolve) => {
    release = resolve
  })
  return previous.then(task).finally(() => release())
}
