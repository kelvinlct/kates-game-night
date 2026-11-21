CREATE TABLE "waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"game_night_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"guest_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_night" ADD COLUMN "waitlist_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_game_night_id_game_night_id_fk" FOREIGN KEY ("game_night_id") REFERENCES "public"."game_night"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "waitlist_night_created_idx" ON "waitlist" USING btree ("game_night_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_night_user_unique" ON "waitlist" USING btree ("game_night_id","user_id") WHERE "waitlist"."user_id" is not null;
