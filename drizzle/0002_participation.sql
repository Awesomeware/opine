CREATE TYPE "public"."feedback_reaction_kind" AS ENUM('agree', 'disagree');--> statement-breakpoint
CREATE TABLE "feedback_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"edited_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_comment_body_valid" CHECK (char_length(btrim("feedback_comment"."body")) between 1 and 10000 and char_length("feedback_comment"."body") <= 10000),
	CONSTRAINT "feedback_comment_version_positive" CHECK ("feedback_comment"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "feedback_reaction" (
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"kind" "feedback_reaction_kind" NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_reaction_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "feedback_write_receipt" (
	"actor_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"request_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_write_receipt_actor_id_request_id_pk" PRIMARY KEY("actor_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "feedback_post" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback_post" ADD COLUMN "edited_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "feedback_comment" ADD CONSTRAINT "feedback_comment_post_id_feedback_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feedback_post"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_comment" ADD CONSTRAINT "feedback_comment_author_id_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reaction" ADD CONSTRAINT "feedback_reaction_post_id_feedback_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feedback_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reaction" ADD CONSTRAINT "feedback_reaction_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_write_receipt" ADD CONSTRAINT "feedback_write_receipt_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_comment_chronological_idx" ON "feedback_comment" USING btree ("post_id","created_at","id");--> statement-breakpoint
CREATE INDEX "feedback_comment_author_idx" ON "feedback_comment" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "feedback_reaction_user_idx" ON "feedback_reaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_write_receipt_rate_idx" ON "feedback_write_receipt" USING btree ("actor_id","operation","created_at");--> statement-breakpoint
ALTER TABLE "feedback_post" ADD CONSTRAINT "feedback_post_version_positive" CHECK ("feedback_post"."version" > 0);