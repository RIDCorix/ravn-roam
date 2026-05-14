CREATE SCHEMA IF NOT EXISTS "roam_poc";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roam_poc"."schema_version" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
