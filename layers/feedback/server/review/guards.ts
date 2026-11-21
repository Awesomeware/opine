import { FeedbackWriteError } from '../writes.ts'

export function checkWorkflowVersion(actual: number, supplied: number) {
  if (actual !== supplied)
    throw new FeedbackWriteError(
      409,
      'The official workflow has changed. Review the latest response and status before saving.',
    )
}
