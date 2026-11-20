CREATE TABLE "feedback_post_tag" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "feedback_post_tag_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "feedback_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "feedback_tag_name_valid" CHECK (char_length(btrim("feedback_tag"."name")) between 1 and 40 and char_length("feedback_tag"."name") <= 40),
	CONSTRAINT "feedback_tag_version_positive" CHECK ("feedback_tag"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "feedback_post_tag" ADD CONSTRAINT "feedback_post_tag_post_id_feedback_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feedback_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_post_tag" ADD CONSTRAINT "feedback_post_tag_tag_id_feedback_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."feedback_tag"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_post_tag_tag_idx" ON "feedback_post_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_tag_name_unique" ON "feedback_tag" USING btree (lower("name"));--> statement-breakpoint
INSERT INTO "feedback_tag" ("id", "name") VALUES
('10000000-0000-4000-8000-000000000001', 'Gameplay'),
('10000000-0000-4000-8000-000000000002', 'UI'),
('10000000-0000-4000-8000-000000000003', 'Class-specific'),
('10000000-0000-4000-8000-000000000004', 'Combat'),
('10000000-0000-4000-8000-000000000005', '$$$');
