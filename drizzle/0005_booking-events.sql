CREATE TABLE "booking_event" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"night_date" date NOT NULL,
	"person_name" text NOT NULL,
	"person_kind" text NOT NULL,
	"person_user_id" text,
	"actor_name" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "booking_event_created_idx" ON "booking_event" USING btree ("created_at");
--> statement-breakpoint
INSERT INTO "booking_event" (
  "id",
  "action",
  "night_date",
  "person_name",
  "person_kind",
  "person_user_id",
  "created_at"
)
SELECT
  gen_random_uuid()::text,
  'joined',
  "game_night"."date",
  "booking"."name",
  CASE WHEN "booking"."user_id" IS NULL THEN 'guest' ELSE 'signed-in' END,
  "booking"."user_id",
  "booking"."created_at"
FROM "booking"
INNER JOIN "game_night" ON "game_night"."id" = "booking"."game_night_id";