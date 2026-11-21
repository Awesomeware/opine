import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from '../../layers/auth/server/schema.ts'

export const eventLog = pgTable(
  'event_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    eventType: text('event_type').notNull(),
    // Null identifies a system action; deleting a human must not change that meaning.
    actorId: text('actor_id').references(() => user.id, { onDelete: 'restrict' }),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index('event_log_chronological_idx').on(table.createdAt, table.id),
    index('event_log_type_chronological_idx').on(table.eventType, table.createdAt, table.id),
  ],
)
