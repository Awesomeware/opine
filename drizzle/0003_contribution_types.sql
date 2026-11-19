CREATE TYPE "public"."feedback_contribution_type" AS ENUM('context', 'different_view', 'suggestion', 'question');--> statement-breakpoint
ALTER TABLE "feedback_comment" ADD COLUMN "type" "feedback_contribution_type";--> statement-breakpoint
CREATE INDEX "feedback_comment_type_chronological_idx" ON "feedback_comment" USING btree ("post_id","type","created_at","id");