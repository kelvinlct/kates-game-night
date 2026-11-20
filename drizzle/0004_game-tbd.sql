ALTER TABLE "game_night" ALTER COLUMN "game" SET DEFAULT 'TBD';
--> statement-breakpoint
UPDATE "game_night" SET "game" = 'TBD' WHERE "game" = 'Undecided';