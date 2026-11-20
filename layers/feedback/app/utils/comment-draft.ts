import { isContributionType, type ContributionType } from '../../shared/contribution-types.ts'
import { isRecord } from './stored-input.ts'

/**
 * Early drafts were plain text, including text that happens to be valid JSON.
 * Only a recognized envelope replaces those original bytes with structured fields.
 */
export function parseComposerDraft(raw: string): { body: string; type: ContributionType | '' } {
  try {
    const value: unknown = JSON.parse(raw)
    if (isRecord(value) && typeof value.body === 'string') {
      return {
        body: value.body,
        type: isContributionType(value.type) ? value.type : '',
      }
    }
  } catch {
    // Non-JSON content is a valid legacy draft, not a storage failure.
  }

  return { body: raw, type: '' }
}
