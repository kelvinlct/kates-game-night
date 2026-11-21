import { relations, sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
)

export const gameNight = pgTable("game_night", {
  id: text("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull().unique(),
  isOpen: boolean("is_open").notNull().default(false),
  capacity: integer("capacity").notNull().default(4),
  /** Local time of day in America/Toronto, HH:mm. Null uses the weekday default. */
  startTime: text("start_time"),
  game: text("game").notNull().default("TBD"),
  location: text("location").notNull().default("Kate's place"),
})

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    gameNightId: text("game_night_id")
      .notNull()
      .references(() => gameNight.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** SHA-256 hex of the guest's httpOnly cookie. Null for signed-in bookings. */
    guestTokenHash: text("guest_token_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("booking_night_idx").on(table.gameNightId),
    uniqueIndex("booking_night_user_unique")
      .on(table.gameNightId, table.userId)
      .where(sql`${table.userId} is not null`),
  ],
)

/**
 * Append-only log of joins and removals. Rows are never updated or deleted.
 * The night date is copied so the line still makes sense if the night changes.
 */
export const bookingEvent = pgTable(
  "booking_event",
  {
    id: text("id").primaryKey(),
    action: text("action").notNull(),
    nightDate: date("night_date", { mode: "string" }).notNull(),
    personName: text("person_name").notNull(),
    /** "signed-in" or "guest". */
    personKind: text("person_kind").notNull(),
    personUserId: text("person_user_id"),
    /** Set when an admin removes someone else. Null for a join or a self-removal. */
    actorName: text("actor_name"),
    actorUserId: text("actor_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("booking_event_created_idx").on(table.createdAt)],
)

export const answerAttempt = pgTable(
  "answer_attempt",
  {
    id: text("id").primaryKey(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("answer_attempt_ip_created_idx").on(table.ip, table.createdAt)],
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  bookings: many(booking),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const gameNightRelations = relations(gameNight, ({ many }) => ({
  bookings: many(booking),
}))

export const bookingRelations = relations(booking, ({ one }) => ({
  gameNight: one(gameNight, {
    fields: [booking.gameNightId],
    references: [gameNight.id],
  }),
  user: one(user, { fields: [booking.userId], references: [user.id] }),
}))

export const authSchema = { user, session, account, verification }
