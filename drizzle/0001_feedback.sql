CREATE TYPE "public"."feedback_status" AS ENUM('new', 'reviewing', 'planned', 'delivered', 'not_planned', 'answered');--> statement-breakpoint
CREATE TABLE "feedback_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_category_slug_unique" UNIQUE("slug"),
	CONSTRAINT "feedback_category_slug_valid" CHECK ("feedback_category"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("feedback_category"."slug") <= 80),
	CONSTRAINT "feedback_category_name_valid" CHECK (char_length(btrim("feedback_category"."name")) between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "feedback_follow" (
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_follow_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "feedback_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"desired_improvement" text,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_post_title_valid" CHECK (char_length(btrim("feedback_post"."title")) between 1 and 200 and char_length("feedback_post"."title") <= 200),
	CONSTRAINT "feedback_post_description_valid" CHECK (char_length(btrim("feedback_post"."description")) between 1 and 10000 and char_length("feedback_post"."description") <= 10000),
	CONSTRAINT "feedback_post_improvement_valid" CHECK ("feedback_post"."desired_improvement" is null or (char_length(btrim("feedback_post"."desired_improvement")) between 1 and 5000 and char_length("feedback_post"."desired_improvement") <= 5000))
);
--> statement-breakpoint
ALTER TABLE "feedback_follow" ADD CONSTRAINT "feedback_follow_post_id_feedback_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feedback_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_follow" ADD CONSTRAINT "feedback_follow_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_post" ADD CONSTRAINT "feedback_post_author_id_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_post" ADD CONSTRAINT "feedback_post_category_id_feedback_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."feedback_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_follow_user_idx" ON "feedback_follow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_post_newest_idx" ON "feedback_post" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "feedback_post_category_newest_idx" ON "feedback_post" USING btree ("category_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "feedback_post_status_newest_idx" ON "feedback_post" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "feedback_post_author_idx" ON "feedback_post" USING btree ("author_id");
--> statement-breakpoint
INSERT INTO "feedback_category" ("slug", "name") VALUES ('general', 'General feedback');
