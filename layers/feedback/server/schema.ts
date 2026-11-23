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
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { user } from '../../auth/server/schema.ts'
import { contributionTypes } from '../shared/discussion/contribution-types.ts'
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
    workflowVersion: integer('workflow_version').notNull().default(1),
    version: integer('version').notNull().default(1),
    editedAt: timestamp('edited_at', { withTimezone: true, precision: 3 }),
    lockedAt: timestamp('locked_at', { withTimezone: true, precision: 3 }),
    archivedAt: timestamp('archived_at', { withTimezone: true, precision: 3 }),
    status: feedbackStatus('status').notNull().default('new'),
    // Match the precision of JS Date so pagination cursors preserve ordering exactly.
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    check('feedback_post_version_positive', sql`${table.version} > 0`),
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

export const feedbackContributionType = pgEnum('feedback_contribution_type', contributionTypes)

export const feedbackComment = pgTable(
  'feedback_comment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => feedbackPost.id, { onDelete: 'restrict' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    type: feedbackContributionType('type'),
    version: integer('version').notNull().default(1),
    editedAt: timestamp('edited_at', { withTimezone: true, precision: 3 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'feedback_comment_body_valid',
      sql`char_length(btrim(${table.body})) between 1 and 10000 and char_length(${table.body}) <= 10000`,
    ),
    check('feedback_comment_version_positive', sql`${table.version} > 0`),
    index('feedback_comment_chronological_idx').on(table.postId, table.createdAt, table.id),
    index('feedback_comment_type_chronological_idx').on(
      table.postId,
      table.type,
      table.createdAt,
      table.id,
    ),
    index('feedback_comment_author_idx').on(table.authorId),
  ],
)

export const feedbackReactionKind = pgEnum('feedback_reaction_kind', ['agree', 'disagree'])
export const feedbackReaction = pgTable(
  'feedback_reaction',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => feedbackPost.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: feedbackReactionKind('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index('feedback_reaction_user_idx').on(table.userId),
  ],
)

export const feedbackOfficialResponse = pgTable(
  'feedback_official_response',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => feedbackPost.id, { onDelete: 'restrict' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    previousStatus: feedbackStatus('previous_status'),
    status: feedbackStatus('status'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'feedback_response_body_valid',
      sql`char_length(btrim(${table.body})) between 1 and 10000 and char_length(${table.body}) <= 10000`,
    ),
    check(
      'feedback_response_status_delta_valid',
      sql`(${table.previousStatus} is null and ${table.status} is null) or (${table.previousStatus} is not null and ${table.status} is not null and ${table.previousStatus} <> ${table.status})`,
    ),
    index('feedback_response_chronological_idx').on(table.postId, table.createdAt, table.id),
  ],
)
export const feedbackNotification = pgTable(
  'feedback_notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    responseId: uuid('response_id')
      .notNull()
      .references(() => feedbackOfficialResponse.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true, precision: 3 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('feedback_notification_recipient_response_idx').on(table.userId, table.responseId),
    index('feedback_notification_inbox_idx').on(table.userId, table.createdAt, table.id),
  ],
)
export const feedbackCategoryChange = pgTable(
  'feedback_category_change',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => feedbackPost.id, { onDelete: 'restrict' }),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    previousCategoryId: uuid('previous_category_id')
      .notNull()
      .references(() => feedbackCategory.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => feedbackCategory.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index('feedback_category_change_chronological_idx').on(table.postId, table.createdAt, table.id),
  ],
)

export const feedbackTag = pgTable(
  'feedback_tag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    icon: text('icon'),
    isActive: boolean('is_active').notNull().default(true),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('feedback_tag_name_unique').on(sql`lower(${table.name})`),
    check(
      'feedback_tag_name_valid',
      sql`char_length(btrim(${table.name})) between 1 and 40 and char_length(${table.name}) <= 40`,
    ),
    check('feedback_tag_version_positive', sql`${table.version} > 0`),
  ],
)
export const feedbackPostTag = pgTable(
  'feedback_post_tag',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => feedbackPost.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => feedbackTag.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index('feedback_post_tag_tag_idx').on(table.tagId),
  ],
)
