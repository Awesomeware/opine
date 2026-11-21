import { and, eq, gt, lt, or } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

// Cursors identify a position in timestamp/UUID ordering, not a database snapshot.
export type PageCursor = { createdAt: string; id: string }
export type Pagination = { cursor?: PageCursor; limit?: number }

export const defaultPageSize = 20
const maximumPageSize = 50

export function parsePaginationInput(
  query: Record<string, unknown>,
):
  | { success: true; data: { cursor?: PageCursor; limit: number } }
  | { success: false; message: string } {
  if (
    Object.keys(query).some(
      (key) => !['cursor', 'limit'].includes(key) || typeof query[key] !== 'string',
    )
  ) {
    return { success: false, message: 'Invalid pagination.' }
  }

  const limit = query.limit === undefined ? defaultPageSize : Number(query.limit)
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > maximumPageSize ||
    (query.limit !== undefined && !/^\d+$/.test(String(query.limit)))
  ) {
    return { success: false, message: 'Page size must be between 1 and 50.' }
  }

  let cursor: PageCursor | undefined
  if (query.cursor) {
    try {
      if (
        typeof query.cursor !== 'string' ||
        query.cursor.length > 256 ||
        !/^[A-Za-z0-9_-]+$/.test(query.cursor)
      ) {
        throw new Error()
      }

      const decoded: unknown = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'))
      if (
        !decoded ||
        typeof decoded !== 'object' ||
        !('id' in decoded) ||
        typeof decoded.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.id) ||
        !('createdAt' in decoded) ||
        typeof decoded.createdAt !== 'string' ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(decoded.createdAt) ||
        decoded.createdAt.startsWith('0000-') ||
        new Date(decoded.createdAt).toISOString() !== decoded.createdAt
      ) {
        throw new Error()
      }

      cursor = { id: decoded.id, createdAt: decoded.createdAt }
    } catch {
      return { success: false, message: 'Invalid page cursor.' }
    }
  }

  return { success: true, data: { cursor, limit } }
}

/** Match the query's explicit ORDER BY on createdAt, then id, in the same direction. */
export function cursorCondition(
  columns: { createdAt: AnyPgColumn<{ data: Date }>; id: AnyPgColumn<{ data: string }> },
  cursor: PageCursor | undefined,
  direction: 'asc' | 'desc',
) {
  if (!cursor) {
    return undefined
  }

  const compare = direction === 'asc' ? gt : lt
  const createdAt = new Date(cursor.createdAt)
  return or(
    compare(columns.createdAt, createdAt),
    and(eq(columns.createdAt, createdAt), compare(columns.id, cursor.id)),
  )
}

/** Pass ordered rows fetched with LIMIT limit + 1; the extra row is only a sentinel. */
export function paginateRows<T extends { id: string; createdAt: Date }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit)
  return { items, nextCursor: cursorFor(items.at(-1), rows.length > limit) }
}

export function cursorFor(row: { id: string; createdAt: Date } | undefined, more: boolean) {
  return more && row
    ? Buffer.from(JSON.stringify({ id: row.id, createdAt: row.createdAt.toISOString() })).toString(
        'base64url',
      )
    : null
}
