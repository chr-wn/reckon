-- Groups and drills are gone; predictions are now simply public or private.
-- Backfill before dropping the group tables: anything that was shared with a
-- group becomes public, everything else stays private.
ALTER TABLE "questions" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
UPDATE "questions" SET "visibility" = CASE
  WHEN EXISTS (SELECT 1 FROM "question_groups" qg WHERE qg."question_id" = "questions"."id") THEN 'public'
  ELSE 'private'
END;--> statement-breakpoint
DROP TABLE "drill_attempts" CASCADE;--> statement-breakpoint
DROP TABLE "group_members" CASCADE;--> statement-breakpoint
DROP TABLE "groups" CASCADE;--> statement-breakpoint
DROP TABLE "question_groups" CASCADE;--> statement-breakpoint
-- Sign-in is Google now.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub");
