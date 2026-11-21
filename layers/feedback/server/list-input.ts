import {
  isContributionType,
  type ContributionType,
} from '../shared/discussion/contribution-types.ts'
import { parsePaginationInput, type PageCursor } from '../../../server/pagination.ts'
import { isPostStatus, type PostStatus } from '../shared/status.ts'

export type ListPostsInput = {
  q?: string
  category?: string
  status?: PostStatus
  cursor?: PageCursor
  limit: number
}

export function parseListInput(
  query: Record<string, unknown>,
): { success: true; data: ListPostsInput } | { success: false; message: string } {
  for (const key of Object.keys(query)) {
    if (
      !['q', 'category', 'status', 'cursor', 'limit'].includes(key) ||
      typeof query[key] !== 'string'
    ) {
      return { success: false, message: 'Invalid feedback filters.' }
    }
  }
  const q = typeof query.q === 'string' ? query.q.trim() : undefined
  const category = typeof query.category === 'string' ? query.category : undefined
  if (
    (q && (q.length > 200 || q.includes('\0'))) ||
    (category && (category.length > 80 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(category)))
  ) {
    return { success: false, message: 'Invalid search or category.' }
  }
  const status = query.status || undefined
  if (status !== undefined && !isPostStatus(status))
    return { success: false, message: 'Invalid status.' }
  const parsed = parsePaginationInput({
    ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
  })
  return parsed.success
    ? {
        success: true,
        data: { ...parsed.data, q: q || undefined, category: category || undefined, status },
      }
    : parsed
}

export function parseCommentListInput(
  query: Record<string, unknown>,
):
  | { success: true; data: { cursor?: PageCursor; limit: number; type?: ContributionType } }
  | { success: false; message: string } {
  if (Object.keys(query).some((key) => !['cursor', 'limit', 'type'].includes(key)))
    return { success: false, message: 'Invalid discussion filters.' }
  const { type, ...pagination } = query
  if ('type' in query && !isContributionType(type))
    return { success: false, message: 'Invalid contribution type.' }
  const parsed = parsePaginationInput(pagination)
  if (!parsed.success) return parsed
  return {
    success: true,
    data: {
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      ...(isContributionType(type) ? { type } : {}),
    },
  }
}

export function parseDiscussionListInput(query: Record<string, unknown>) {
  if (query.type === 'team') {
    const { type: _type, ...pagination } = query
    const parsed = parseCommentListInput(pagination)
    return parsed.success
      ? { success: true as const, data: { ...parsed.data, type: 'team' as const } }
      : parsed
  }
  return parseCommentListInput(query)
}

export function parseReviewInput(query: Record<string, unknown>) {
  if (
    Object.keys(query).some(
      (key) => !['category', 'status', 'followUp', 'cursor', 'limit'].includes(key),
    ) ||
    (query.followUp !== undefined && query.followUp !== 'true' && query.followUp !== 'false')
  )
    return { success: false as const, message: 'Invalid review filters.' }
  const { followUp, status, ...rest } = query
  const parsed = parseListInput({
    ...rest,
    ...(status === 'all' ? {} : { status: status ?? 'new' }),
  })
  return parsed.success
    ? {
        success: true as const,
        data: {
          ...parsed.data,
          status: status === 'all' ? ('all' as const) : parsed.data.status,
          followUp: followUp === 'true',
        },
      }
    : parsed
}

export function parseNotificationListInput(query: Record<string, unknown>) {
  if (
    Object.keys(query).some((key) => !['unread', 'cursor', 'limit'].includes(key)) ||
    (query.unread !== undefined && query.unread !== 'true' && query.unread !== 'false')
  )
    return { success: false as const, message: 'Invalid notification filters.' }
  const { unread, ...rest } = query
  const parsed = parsePaginationInput(rest)
  return parsed.success
    ? {
        success: true as const,
        data: { cursor: parsed.data.cursor, limit: parsed.data.limit, unread: unread === 'true' },
      }
    : parsed
}
