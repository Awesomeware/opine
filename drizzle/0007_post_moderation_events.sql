CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_post" ADD COLUMN "locked_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "feedback_post" ADD COLUMN "archived_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_log_chronological_idx" ON "event_log" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "event_log_type_chronological_idx" ON "event_log" USING btree ("event_type","created_at","id");