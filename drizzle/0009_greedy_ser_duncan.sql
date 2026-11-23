ALTER TABLE "feedback_post" DROP CONSTRAINT "feedback_post_category_id_feedback_category_id_fk";
--> statement-breakpoint
DROP INDEX "feedback_post_category_newest_idx";
--> statement-breakpoint
ALTER TABLE "feedback_post" DROP COLUMN "category_id";
--> statement-breakpoint
DROP TABLE "feedback_category_change";
--> statement-breakpoint
DROP TABLE "feedback_category";
