CREATE TABLE "feedback_category_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"previous_category_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"response_id" uuid NOT NULL,
	"read_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_official_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"previous_status" "feedback_status",
	"status" "feedback_status",
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_response_body_valid" CHECK (char_length(btrim("feedback_official_response"."body")) between 1 and 10000 and char_length("feedback_official_response"."body") <= 10000),
	CONSTRAINT "feedback_response_status_delta_valid" CHECK (("feedback_official_response"."previous_status" is null and "feedback_official_response"."status" is null) or ("feedback_official_response"."previous_status" is not null and "feedback_official_response"."status" is not null and "feedback_official_response"."previous_status" <> "feedback_official_response"."status"))
);
--> statement-breakpoint
ALTER TABLE "feedback_post" ADD COLUMN "workflow_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback_category_change" ADD CONSTRAINT "feedback_category_change_post_id_feedback_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feedback_post"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_category_change" ADD CONSTRAINT "feedback_category_change_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_category_change" ADD CONSTRAINT "feedback_category_change_previous_category_id_feedback_category_id_fk" FOREIGN KEY ("previous_category_id") REFERENCES "public"."feedback_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_category_change" ADD CONSTRAINT "feedback_category_change_category_id_feedback_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."feedback_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_notification" ADD CONSTRAINT "feedback_notification_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_notification" ADD CONSTRAINT "feedback_notification_response_id_feedback_official_response_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."feedback_official_response"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_official_response" ADD CONSTRAINT "feedback_official_response_post_id_feedback_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feedback_post"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_official_response" ADD CONSTRAINT "feedback_official_response_author_id_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_category_change_chronological_idx" ON "feedback_category_change" USING btree ("post_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_notification_recipient_response_idx" ON "feedback_notification" USING btree ("user_id","response_id");--> statement-breakpoint
CREATE INDEX "feedback_notification_inbox_idx" ON "feedback_notification" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "feedback_response_chronological_idx" ON "feedback_official_response" USING btree ("post_id","created_at","id");