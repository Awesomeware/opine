import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from '../../auth/server/schema.ts'
import { postStatuses } from '../shared/status.ts'

export const feedbackCategory = pgTable(
  'feedback_category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'feedback_category_slug_valid',
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${table.slug}) <= 80`,
    ),
    check('feedback_category_name_valid', sql`char_length(btrim(${table.name})) between 1 and 80`),
  ],
)

export const feedbackStatus = pgEnum('feedback_status', postStatuses)
export const feedbackPost = pgTable(
  'feedback_post',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => feedbackCategory.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    desiredImprovement: text('desired_improvement'),
    status: feedbackStatus('status').notNull().default('new'),
    // Match the precision of JS Date so pagination cursors preserve ordering exactly.
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index('feedback_post_newest_idx').on(table.createdAt.desc(), table.id.desc()),
    index('feedback_post_category_newest_idx').on(
      table.categoryId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('feedback_post_status_newest_idx').on(
      table.status,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('feedback_post_author_idx').on(table.authorId),
    check(
      'feedback_post_title_valid',
      sql`char_length(btrim(${table.title})) between 1 and 200 and char_length(${table.title}) <= 200`,
    ),
    check(
      'feedback_post_description_valid',
      sql`char_length(btrim(${table.description})) between 1 and 10000 and char_length(${table.description}) <= 10000`,
    ),
    check(
      'feedback_post_improvement_valid',
      sql`${table.desiredImprovement} is null or (char_length(btrim(${table.desiredImprovement})) between 1 and 5000 and char_length(${table.desiredImprovement}) <= 5000)`,
    ),
  ],
)

export const feedbackFollow = pgTable(
  'feedback_follow',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => feedbackPost.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index('feedback_follow_user_idx').on(table.userId),
  ],
)
