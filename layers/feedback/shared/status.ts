export const postStatuses = [
  'new',
  'reviewing',
  'planned',
  'delivered',
  'not_planned',
  'answered',
] as const
export type PostStatus = (typeof postStatuses)[number]
export const statusLabels: Record<PostStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  planned: 'Planned',
  delivered: 'Delivered',
  not_planned: 'Not planned',
  answered: 'Answered',
}
export function isPostStatus(value: unknown): value is PostStatus {
  return postStatuses.some((status) => status === value)
}
